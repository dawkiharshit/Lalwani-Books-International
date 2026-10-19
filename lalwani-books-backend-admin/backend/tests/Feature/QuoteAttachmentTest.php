<?php

namespace Tests\Feature;

use App\Models\ContactMessage;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The reading list people attach to "Request a quote": kept privately beside
 * the message, handed only to a signed-in admin, and always served as the
 * kind of file it was checked to be.
 *
 * Runs inside a rolled-back transaction, so it needs an already-migrated
 * database (the default in-memory SQLite has no tables), e.g.:
 *   DB_CONNECTION=mysql DB_DATABASE=lalwani_books_test php artisan test --filter=QuoteAttachmentTest
 */
class QuoteAttachmentTest extends TestCase
{
    use DatabaseTransactions;

    private const CSV = "Title,Author,Copies\nWings of Fire,A P J Abdul Kalam,40\nIkigai,Hector Garcia,20\n";

    protected function setUp(): void
    {
        parent::setUp();
        // Files go to a throwaway folder, never the shop's own storage.
        Storage::fake('local');
    }

    private function enquiry(array $override = []): array
    {
        return $override + [
            'name' => 'Meera Nair',
            'organisation' => 'Green Valley Public School',
            'type' => 'school',
            'email' => 'library@greenvalley.example',
            'phone' => '011-2345 6789',
        ];
    }

    private function send(array $files, array $override = [])
    {
        return $this->post('/api/v1/institution-enquiries', $this->enquiry($override) + ['files' => $files], ['Accept' => 'application/json']);
    }

    public function test_a_csv_list_is_kept_and_handed_to_the_admin(): void
    {
        $this->send([UploadedFile::fake()->createWithContent('class 6 list.csv', self::CSV)])->assertCreated();

        $saved = ContactMessage::query()->latest('id')->first();
        $this->assertStringContainsString('Attached: class 6 list.csv', $saved->message);

        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));
        $listed = $this->getJson('/api/v1/admin/messages')->assertOk()->json('data.0.attachments');
        $this->assertCount(1, $listed);
        $this->assertSame('class 6 list.csv', $listed[0]['name']);
        $this->assertSame('text/csv', $listed[0]['type']);

        $file = $this->get("/api/v1/admin/messages/{$saved->id}/files/{$listed[0]['id']}")->assertOk();
        $this->assertStringStartsWith('text/csv', (string) $file->headers->get('content-type'));
        $this->assertSame('nosniff', $file->headers->get('x-content-type-options'));
        $this->assertStringContainsString('attachment; filename="class 6 list.csv"', (string) $file->headers->get('content-disposition'));
        $this->assertSame(self::CSV, $file->streamedContent());
    }

    public function test_a_pdf_is_served_as_a_pdf(): void
    {
        $pdf = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n\x00\x01binary tail";
        $this->send([UploadedFile::fake()->createWithContent('requirement.pdf', $pdf)])->assertCreated();

        $saved = ContactMessage::query()->latest('id')->first();
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));

        $file = $this->get("/api/v1/admin/messages/{$saved->id}/files/1")->assertOk();
        $this->assertSame('application/pdf', $file->headers->get('content-type'));
        $this->assertSame($pdf, $file->streamedContent());
    }

    public function test_a_file_that_is_neither_is_refused_and_nothing_is_stored(): void
    {
        $before = ContactMessage::count();
        // A PNG renamed .csv: what it is named proves nothing.
        $png = "\x89PNG\r\n\x1a\n".str_repeat("\x00\x10", 50);

        $this->send([UploadedFile::fake()->createWithContent('list.csv', $png)])
            ->assertStatus(422)
            ->assertJsonPath('errors.files.0', 'Attach your list as a CSV or a PDF file — that one is neither.');

        $this->assertSame($before, ContactMessage::count());
    }

    public function test_more_files_than_allowed_are_refused(): void
    {
        $four = array_map(fn ($i) => UploadedFile::fake()->createWithContent("list-{$i}.csv", self::CSV), range(1, 4));

        $this->send($four)->assertStatus(422)->assertJsonPath('errors.files.0', 'Attach up to 3 files.');
    }

    public function test_a_quote_request_without_a_file_still_works(): void
    {
        $this->postJson('/api/v1/institution-enquiries', $this->enquiry())->assertCreated();

        $saved = ContactMessage::query()->latest('id')->first();
        $this->assertStringNotContainsString('Attached:', $saved->message);
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));
        $this->assertSame([], $this->getJson('/api/v1/admin/messages')->assertOk()->json('data.0.attachments'));
    }

    public function test_deleting_the_message_takes_its_files_with_it(): void
    {
        $this->send([UploadedFile::fake()->createWithContent('list.csv', self::CSV)])->assertCreated();
        $saved = ContactMessage::query()->latest('id')->first();

        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));
        $this->deleteJson("/api/v1/admin/messages/{$saved->id}")->assertOk();

        $left = array_filter(Storage::disk('local')->allFiles('quote-files'), fn ($p) => str_contains($p, "/{$saved->id}/"));
        $this->assertSame([], array_values($left));
        $this->get("/api/v1/admin/messages/{$saved->id}/files/1")->assertNotFound();
    }

    public function test_the_unread_count_follows_the_messages(): void
    {
        Sanctum::actingAs(User::factory()->create(["is_admin" => true]));
        $before = $this->getJson("/api/v1/admin/messages/count")->assertOk()->json("data.unread");

        $this->send([UploadedFile::fake()->createWithContent("list.csv", self::CSV)])->assertCreated();
        $this->assertSame($before + 1, $this->getJson("/api/v1/admin/messages/count")->json("data.unread"));

        // Reading it takes it off the count again.
        $saved = ContactMessage::query()->latest("id")->first();
        $this->putJson("/api/v1/admin/messages/{$saved->id}", ["is_read" => true])->assertOk();
        $this->assertSame($before, $this->getJson("/api/v1/admin/messages/count")->json("data.unread"));

        $this->getJson("/api/v1/admin/messages/count")->assertOk();
    }

    public function test_a_file_is_not_handed_to_a_visitor_who_is_not_an_admin(): void
    {
        $this->send([UploadedFile::fake()->createWithContent('list.csv', self::CSV)])->assertCreated();
        $saved = ContactMessage::query()->latest('id')->first();

        $this->getJson("/api/v1/admin/messages/{$saved->id}/files/1")->assertUnauthorized();

        Sanctum::actingAs(User::factory()->create(['is_admin' => false]));
        $this->getJson("/api/v1/admin/messages/{$saved->id}/files/1")->assertForbidden();
    }
}
