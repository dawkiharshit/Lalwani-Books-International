<?php

namespace Tests\Feature;

use App\Models\Author;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Search: suggestions while typing (books, authors, categories, ISBNs) and
 * the full search by title, author, ISBN or subject.
 *
 * Runs inside a rolled-back transaction, so it needs an already-migrated
 * database (the default in-memory SQLite has no tables), e.g.:
 *   DB_CONNECTION=mysql DB_DATABASE=lalwani_books_test php artisan test --filter=SearchSuggestTest
 */
class SearchSuggestTest extends TestCase
{
    use DatabaseTransactions;

    private Category $category;

    private Author $author;

    private Product $book;

    protected function setUp(): void
    {
        parent::setUp();

        $this->category = Category::create(['name' => 'Quokka Studies', 'slug' => 'quokka-studies-'.uniqid()]);
        $this->author = Author::create(['name' => 'Quentin Quokkaworth', 'slug' => 'quentin-'.uniqid()]);

        $template = Product::query()->first();
        abort_unless($template, 500, 'The test database needs at least one product to copy.');
        $this->book = $template->replicate();
        $this->book->forceFill([
            'name' => 'The Quokka Handbook',
            'slug' => 'quokka-handbook-'.uniqid(),
            'sku' => 'QK-'.uniqid(),
            'author' => 'Quentin Quokkaworth',
            'author_id' => $this->author->id,
            'isbn' => '978-1-23456-789-7',
            'category_id' => $this->category->id,
            'is_active' => true,
        ])->save();
    }

    private function suggest(string $q): array
    {
        return $this->getJson('/api/v1/search/suggest?q='.urlencode($q))->assertOk()->json('data');
    }

    public function test_suggestions_come_grouped_by_book_author_and_category(): void
    {
        $data = $this->suggest('quokka');

        $this->assertContains('The Quokka Handbook', array_column($data['books'], 'name'));
        $this->assertContains('Quentin Quokkaworth', array_column($data['authors'], 'name'));
        $this->assertContains('Quokka Studies', array_column($data['categories'], 'name'));
        $this->assertSame(1, collect($data['authors'])->firstWhere('name', 'Quentin Quokkaworth')['books']);
    }

    public function test_an_isbn_is_found_with_or_without_dashes(): void
    {
        foreach (['9781234567897', '978-1-23456', '23456789'] as $q) {
            $this->assertContains('The Quokka Handbook', array_column($this->suggest($q)['isbn'], 'name'), "for {$q}");
        }
    }

    public function test_short_or_wildcard_queries_suggest_nothing(): void
    {
        foreach (['q', '%%', '__'] as $q) {
            $data = $this->suggest($q);
            $this->assertSame([], $data['books'], "for {$q}");
            $this->assertSame([], $data['authors'], "for {$q}");
        }
    }

    public function test_the_full_search_matches_a_subject(): void
    {
        $names = collect($this->getJson('/api/v1/products?per_page=100&search=Quokka%20Studies')->assertOk()->json('data'))->pluck('name');

        $this->assertContains('The Quokka Handbook', $names);
    }

    public function test_suggestions_may_be_cached_by_the_browser_for_a_minute(): void
    {
        $this->getJson('/api/v1/search/suggest?q=quokka')->assertHeader('Cache-Control', 'max-age=60, public');
    }
}
