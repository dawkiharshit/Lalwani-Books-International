<?php

namespace Tests\Feature;

use App\Models\Setting;
use App\Models\User;
use App\Support\StaffAccess;
use App\Support\VoiceQueries;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The website's mic button: a customer records a question (a guest leaves a
 * mobile number), it is kept privately, and admin → Voice Queries plays it.
 *
 * Runs inside a rolled-back transaction, so it needs an already-migrated
 * database, e.g.:
 *   DB_CONNECTION=mysql DB_DATABASE=lalwani_books_test php artisan test --filter=VoiceQueriesTest
 */
class VoiceQueriesTest extends TestCase
{
    use DatabaseTransactions;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();

        Setting::flush();
        Storage::fake('local');
        $this->owner = User::factory()->create(['is_admin' => true]);
    }

    protected function tearDown(): void
    {
        VoiceQueries::$perDay = 100;
        VoiceQueries::$kept = 1000;
        Setting::flush();

        parent::tearDown();
    }

    /** What a browser's recorder hands over: a WebM (Chrome), Ogg (Firefox) or MP4 (Safari) file. */
    private function recording(string $kind = 'webm', int $bytes = 4000): UploadedFile
    {
        $head = ['webm' => "\x1A\x45\xDF\xA3", 'ogg' => 'OggS', 'mp4' => "\x00\x00\x00\x20ftypM4A ", 'png' => "\x89PNG\r\n\x1a\n"][$kind];

        return UploadedFile::fake()->createWithContent("voice.$kind", $head.str_repeat("\x00\x11", intdiv($bytes, 2)));
    }

    /** Each send from its own visitor address unless one is given — the route allows six per address in ten minutes. */
    private function send(array $fields, ?UploadedFile $audio = null, ?string $ip = null)
    {
        static $n = 0;

        return $this->withServerVariables(['REMOTE_ADDR' => $ip ?? '10.9.0.'.(++$n % 250 + 1)])
            ->post('/api/v1/voice-queries', $fields + ['audio' => $audio ?? $this->recording(), 'seconds' => 34], ['Accept' => 'application/json']);
    }

    public function test_a_guest_must_leave_a_mobile_number(): void
    {
        $this->send([])->assertStatus(422)
            ->assertJsonPath('errors.phone.0', 'Enter your 10-digit mobile number so we can call you back.');
        $this->send(['phone' => '12345'])->assertStatus(422)->assertJsonValidationErrors('phone');

        Sanctum::actingAs($this->owner);
        $this->getJson('/api/v1/admin/voice-queries?status=all')->assertOk()->assertJsonPath('meta.total', 0);
    }

    public function test_a_guest_recording_is_kept_privately_and_the_owner_can_listen(): void
    {
        $audio = $this->recording('webm', 6000);
        $bytes = file_get_contents($audio->getRealPath());

        $this->send(['phone' => '+91 98100-12345', 'page' => '/product/the-alchemist'], $audio)
            ->assertCreated()
            ->assertJsonPath('message', 'Thank you! We got your question and will call you back on +91 98100 12345 soon.');

        Sanctum::actingAs($this->owner);
        $list = $this->getJson('/api/v1/admin/voice-queries')->assertOk()->json();
        $this->assertSame(1, $list['meta']['new']);
        $entry = $list['data'][0];
        $this->assertSame('9810012345', $entry['phone']);
        $this->assertSame(34, $entry['seconds']);
        $this->assertSame('/product/the-alchemist', $entry['page']);
        $this->assertNull($entry['user']);
        $this->assertSame('new', $entry['status']);
        $this->assertSame('audio/webm', $entry['type']);
        $this->getJson('/api/v1/admin/voice-queries/count')->assertJsonPath('data.new', 1);

        $played = $this->get("/api/v1/admin/voice-queries/{$entry['id']}/audio")->assertOk();
        $this->assertSame('audio/webm', $played->headers->get('Content-Type'));
        $this->assertStringContainsString('no-store', (string) $played->headers->get('Cache-Control'));
        $this->assertSame('nosniff', $played->headers->get('X-Content-Type-Options'));
        $this->assertSame($bytes, file_get_contents($played->baseResponse->getFile()->getPathname()));

        // Kept in private storage, never under public/.
        $this->assertStringContainsString('voice-queries', $played->baseResponse->getFile()->getPathname());
        $this->assertFalse(Storage::disk('public')->exists('voice-queries'));
    }

    public function test_a_signed_in_customer_needs_no_number(): void
    {
        $customer = User::factory()->create(['name' => 'Asha Rao', 'phone' => '098765 43210']);
        Sanctum::actingAs($customer);

        $this->send([], $this->recording('mp4'))
            ->assertCreated()
            ->assertJsonPath('message', 'Thank you! We got your question and will call you back on +91 98765 43210 soon.');

        Sanctum::actingAs($this->owner);
        $entry = $this->getJson('/api/v1/admin/voice-queries')->json('data.0');
        $this->assertSame(['id' => $customer->id, 'name' => 'Asha Rao', 'email' => $customer->email], $entry['user']);
        $this->assertSame('9876543210', $entry['phone']);
        $this->assertSame('audio/mp4', $entry['type']);
    }

    public function test_only_real_recordings_from_this_site_are_taken(): void
    {
        $phone = ['phone' => '9810012345'];
        $this->send($phone, $this->recording('png'))->assertStatus(422)->assertJsonValidationErrors('audio');
        $this->send($phone, $this->recording('webm', 200))->assertStatus(422);
        $this->send($phone, UploadedFile::fake()->create('long.webm', VoiceQueries::MAX_KB + 10))->assertStatus(422);
        $this->withServerVariables(['REMOTE_ADDR' => '10.8.0.1'])
            ->post('/api/v1/voice-queries', $phone + ['audio' => $this->recording(), 'seconds' => 0], ['Accept' => 'application/json'])->assertStatus(422);
        foreach (['https://evil.example/x', '//evil.example', '/a b', '/x"onmouseover="y'] as $page) {
            $this->send($phone + ['page' => $page])->assertStatus(422)->assertJsonValidationErrors('page');
        }
        $this->send($phone, $this->recording('ogg'))->assertCreated();

        Sanctum::actingAs($this->owner);
        $this->getJson('/api/v1/admin/voice-queries?status=all')->assertJsonPath('meta.total', 1);
    }

    public function test_the_owner_marks_one_answered_and_deletes_it(): void
    {
        $this->send(['phone' => '9810012345'])->assertCreated();
        Sanctum::actingAs($this->owner);
        $id = $this->getJson('/api/v1/admin/voice-queries')->json('data.0.id');

        $this->putJson("/api/v1/admin/voice-queries/{$id}", ['answered' => true])->assertOk()->assertJsonPath('data.status', 'answered');
        $this->getJson('/api/v1/admin/voice-queries/count')->assertJsonPath('data.new', 0);
        $this->getJson('/api/v1/admin/voice-queries?status=new')->assertJsonPath('meta.total', 0);
        $this->getJson('/api/v1/admin/voice-queries?status=answered')->assertJsonPath('meta.total', 1);
        $this->putJson("/api/v1/admin/voice-queries/{$id}", ['answered' => false])->assertJsonPath('data.status', 'new');

        $this->deleteJson("/api/v1/admin/voice-queries/{$id}")->assertOk();
        $this->get("/api/v1/admin/voice-queries/{$id}/audio")->assertNotFound();
        $this->getJson('/api/v1/admin/voice-queries?status=all')->assertJsonPath('meta.total', 0);
        $this->assertSame([], Storage::disk('local')->allFiles('voice-queries'));
    }

    public function test_only_the_owner_and_inbox_staff_can_listen(): void
    {
        $this->send(['phone' => '9810012345'])->assertCreated();

        $this->getJson('/api/v1/admin/voice-queries')->assertUnauthorized();

        Sanctum::actingAs(User::factory()->create());
        $this->getJson('/api/v1/admin/voice-queries')->assertForbidden();

        $other = User::factory()->create();
        StaffAccess::save($other->id, ['areas' => ['products' => StaffAccess::DIRECT]]);
        Sanctum::actingAs($other);
        $this->getJson('/api/v1/admin/voice-queries')->assertForbidden();

        $viewer = User::factory()->create();
        StaffAccess::save($viewer->id, ['areas' => ['inbox' => StaffAccess::VIEW]]);
        Sanctum::actingAs($viewer);
        $id = $this->getJson('/api/v1/admin/voice-queries')->assertOk()->json('data.0.id');
        $this->get("/api/v1/admin/voice-queries/{$id}/audio")->assertOk();
        $this->putJson("/api/v1/admin/voice-queries/{$id}", ['answered' => true])->assertForbidden();
        $this->deleteJson("/api/v1/admin/voice-queries/{$id}")->assertForbidden();
    }

    public function test_odd_ids_find_nothing(): void
    {
        Sanctum::actingAs($this->owner);
        $this->get('/api/v1/admin/voice-queries/..%2F..%2F.env/audio')->assertNotFound();
        $this->get('/api/v1/admin/voice-queries/abc/audio')->assertNotFound();
        $this->get('/api/v1/admin/voice-queries/01JZZZZZZZZZZZZZZZZZZZZZZZ/audio')->assertNotFound();
    }

    public function test_shop_wide_and_per_visitor_limits(): void
    {
        VoiceQueries::$perDay = 1;
        $this->send(['phone' => '9810012345'])->assertCreated();
        $this->send(['phone' => '9810012345'])->assertStatus(503)->assertJsonPath('message', 'We can’t take voice messages right now. Please WhatsApp or call us instead.');

        // Six tries in ten minutes from one address, then a pause.
        for ($i = 0; $i < 6; $i++) {
            $this->send([], null, '10.7.0.1');
        }
        $this->send([], null, '10.7.0.1')->assertStatus(429);
    }
}
