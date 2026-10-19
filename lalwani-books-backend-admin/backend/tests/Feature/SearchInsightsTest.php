<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\Setting;
use App\Models\User;
use App\Support\SearchLog;
use App\Support\StaffAccess;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Admin → Search insights: the shop notes what shoppers searched for (only
 * the words) and the owner sees the most searched, and what found nothing.
 *
 * Runs inside a rolled-back transaction, so it needs an already-migrated
 * database with a product in it, e.g.:
 *   DB_CONNECTION=mysql DB_DATABASE=lalwani_books_test php artisan test --filter=SearchInsightsTest
 */
class SearchInsightsTest extends TestCase
{
    use DatabaseTransactions;

    private User $owner;

    private Product $book;

    protected function setUp(): void
    {
        parent::setUp();

        Setting::flush();
        Storage::fake('local');
        $this->owner = User::factory()->create(['is_admin' => true]);

        // A book no real search can match by accident.
        $this->book = Product::query()->firstOrFail()->replicate();
        $this->book->forceFill([
            'name' => 'Qwyzzle Insight Atlas',
            'slug' => 'qwyzzle-insight-atlas-'.uniqid(),
            'sku' => 'QIA-'.uniqid(),
            'author' => 'Vrinda Qwyzzle',
            'tagline' => null,
            'isbn' => null,
            'is_active' => true,
        ])->save();
    }

    protected function tearDown(): void
    {
        Setting::flush();

        parent::tearDown();
    }

    /** The folder SearchLog writes to for this database. */
    private function dir(): string
    {
        $database = (string) config('database.connections.'.config('database.default').'.database');

        return 'search-log/'.(preg_replace('/[^A-Za-z0-9_-]/', '', basename($database)) ?: 'default');
    }

    /** Today's noted searches, oldest first. */
    private function lines(): array
    {
        $file = $this->dir().'/'.CarbonImmutable::now(SearchLog::TZ)->format('Y-m-d').'.jsonl';
        if (! Storage::disk('local')->exists($file)) {
            return [];
        }

        return array_map(
            fn ($line) => json_decode($line, true),
            array_values(array_filter(explode("\n", Storage::disk('local')->get($file))))
        );
    }

    private function search(string $words, string $via, ?string $book = null, string $ip = '127.0.0.1')
    {
        return $this->withServerVariables(['REMOTE_ADDR' => $ip])
            ->post('/api/v1/searches', array_filter(['q' => $words, 'via' => $via, 'book' => $book]));
    }

    public function test_the_words_are_tidied_and_nothing_personal_is_kept(): void
    {
        $this->assertSame('harry potter', SearchLog::normalize('  “Harry   POTTER”. '));
        $this->assertSame('c++', SearchLog::normalize('C++'));
        $this->assertSame('9780132350884', SearchLog::normalize('978-0-13-235088-4'));
        $this->assertSame('0132350882', SearchLog::normalize('0-13-235088-2'));
        $this->assertSame('', SearchLog::normalize("\u{200B} \u{200B}"));

        $this->assertTrue(SearchLog::keepable('harry potter'));
        $this->assertTrue(SearchLog::keepable('9780132350884'));
        $this->assertTrue(SearchLog::keepable('ncert class 10 2024 2025'));
        $this->assertFalse(SearchLog::keepable('ravi@example.com'));
        $this->assertFalse(SearchLog::keepable('98100 12345'));
        $this->assertFalse(SearchLog::keepable('+91 98100-12345'));
        $this->assertFalse(SearchLog::keepable('1234 5678 9012'));
        $this->assertFalse(SearchLog::keepable('4111 1111 1111 1111'));
        $this->assertFalse(SearchLog::keepable('a'));
    }

    public function test_a_search_is_noted_with_what_it_found_and_nothing_about_the_shopper(): void
    {
        $this->search('  QWYZZLE  ', 'results')->assertNoContent();

        $lines = $this->lines();
        $this->assertCount(1, $lines);
        $this->assertSame(['t', 'q', 'w', 'n'], array_keys($lines[0]));
        $this->assertSame('qwyzzle', $lines[0]['q']);
        $this->assertSame('results', $lines[0]['w']);
        $this->assertSame(1, $lines[0]['n']);
    }

    public function test_a_search_counts_once_and_odd_or_personal_ones_not_at_all(): void
    {
        $this->search('qwyzzle', 'results');
        $this->search('Qwyzzle', 'results')->assertNoContent();
        $this->search('ravi@example.com', 'results')->assertNoContent();
        $this->search('98100 12345', 'typed')->assertNoContent();
        $this->search('qwyzzle', 'hacked')->assertNoContent();
        $this->search('qwyzzle', 'open', 'no-such-book')->assertNoContent();
        $this->post('/api/v1/searches', ['q' => ['qwyzzle'], 'via' => 'results'])->assertNoContent();

        $this->assertCount(1, $this->lines());
    }

    public function test_a_book_opened_from_a_search_is_credited_without_counting_another_search(): void
    {
        $this->search('insight atlas', 'pick', $this->book->slug);
        $this->search('insight atlas', 'open', $this->book->slug);

        [$pick, $open] = $this->lines();
        $this->assertSame($this->book->id, $pick['b']);
        $this->assertSame(1, $pick['n']);
        $this->assertSame('open', $open['w']);
        $this->assertArrayNotHasKey('n', $open);
    }

    public function test_the_owner_sees_the_most_searched_and_what_found_nothing(): void
    {
        $this->search('qwyzzle', 'results', null, '10.0.0.1');
        $this->search('qwyzzle', 'results', null, '10.0.0.2');
        $this->search('zzyzx unheard of book', 'typed');
        $this->search('insight atlas', 'pick', $this->book->slug);

        Sanctum::actingAs($this->owner);
        $data = $this->getJson('/api/v1/admin/search-insights?days=7')->assertOk()->json('data');

        $this->assertSame(7, $data['days']);
        $this->assertCount(7, $data['daily']);
        $this->assertSame(4, end($data['daily'])['searches']);
        $this->assertSame(['searches' => 4, 'nothing' => 1, 'opened' => 1, 'terms' => 3], $data['totals']);

        $this->assertSame('qwyzzle', $data['top'][0]['term']);
        $this->assertSame(2, $data['top'][0]['count']);
        $this->assertSame(1, $data['top'][0]['found']);

        $this->assertCount(1, $data['missing']);
        $this->assertSame('zzyzx unheard of book', $data['missing'][0]['term']);
        $this->assertSame(0, $data['missing'][0]['now']);

        $this->assertSame($this->book->id, $data['books'][0]['id']);
        $this->assertSame(['insight atlas'], $data['books'][0]['terms']);
        $this->assertSame('pick', $data['recent'][0]['way']);
        $this->assertSame($this->book->name, $data['recent'][0]['book']['name']);

        // Once the shop has a book for it, the search shows as found now.
        $this->book->forceFill(['tagline' => 'Zzyzx unheard of book, at last'])->save();
        $data = $this->getJson('/api/v1/admin/search-insights?days=7')->json('data');
        $this->assertSame(1, $data['missing'][0]['now']);

        // Only the offered periods.
        $this->assertSame(30, $this->getJson('/api/v1/admin/search-insights?days=5')->json('data.days'));
    }

    public function test_counting_several_searches_at_once_agrees_with_one_at_a_time(): void
    {
        $terms = ['qwyzzle', 'insight atlas', 'zzyzx unheard of book', '9780132350884', '100% pure', 'a'];
        $each = SearchLog::matchesEach($terms);

        $this->assertSame(1, $each['qwyzzle']);
        foreach ($terms as $term) {
            $this->assertSame(SearchLog::matches($term), $each[$term], $term);
        }
        $this->assertSame([], SearchLog::matchesEach([]));
    }

    public function test_staff_need_the_search_insights_area(): void
    {
        $this->getJson('/api/v1/admin/search-insights')->assertUnauthorized();

        $viewer = User::factory()->create();
        StaffAccess::save($viewer->id, ['areas' => ['insights' => StaffAccess::VIEW]]);
        $other = User::factory()->create();
        StaffAccess::save($other->id, ['areas' => ['products' => StaffAccess::DIRECT]]);

        Sanctum::actingAs($viewer);
        $this->getJson('/api/v1/admin/search-insights')->assertOk();
        Sanctum::actingAs($other);
        $this->getJson('/api/v1/admin/search-insights')->assertForbidden();
        Sanctum::actingAs(User::factory()->create());
        $this->getJson('/api/v1/admin/search-insights')->assertForbidden();
    }

    public function test_past_days_are_summed_once_and_old_days_dropped(): void
    {
        $disk = Storage::disk('local');
        $past = CarbonImmutable::now(SearchLog::TZ)->subDays(3);
        $old = CarbonImmutable::now(SearchLog::TZ)->subDays(SearchLog::KEEP_DAYS + 5)->format('Y-m-d');
        $line = fn (string $q, int $n) => json_encode(['t' => $past->getTimestamp(), 'q' => $q, 'w' => 'results', 'n' => $n]);
        $disk->put($this->dir().'/'.$past->format('Y-m-d').'.jsonl', $line('gita', 2)."\n".$line('gita', 2)."\n".'not json'."\n");
        $disk->put($this->dir().'/'.$old.'.jsonl', $line('ancient', 0)."\n");

        // Today's first search clears out days past keeping.
        $this->search('qwyzzle', 'results');
        $this->assertFalse($disk->exists($this->dir().'/'.$old.'.jsonl'));

        $first = SearchLog::report(7);
        $this->assertSame(3, $first['totals']['searches']);
        $this->assertSame('gita', $first['top'][0]['term']);

        // The past day was worked out once and kept: the kept figures are used.
        $kept = $this->dir().'/'.$past->format('Y-m-d').'.sum.json';
        $this->assertTrue($disk->exists($kept));
        $sum = json_decode($disk->get($kept), true);
        $sum['searches'] = 40;
        $disk->put($kept, json_encode($sum));
        touch($disk->path($kept), time() + 5);
        $this->assertSame(41, SearchLog::report(7)['totals']['searches']);
    }
}
