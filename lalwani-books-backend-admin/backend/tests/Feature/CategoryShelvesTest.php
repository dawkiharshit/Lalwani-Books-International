<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * The shop's book list filtered by one category, or by several at once (the
 * "Books for Schools / Universities / Corporates" shelves).
 *
 * Runs inside a rolled-back transaction, so it needs an already-migrated
 * database (the default in-memory SQLite has no tables), e.g.:
 *   DB_CONNECTION=mysql DB_DATABASE=lalwani_books_test php artisan test --filter=CategoryShelvesTest
 */
class CategoryShelvesTest extends TestCase
{
    use DatabaseTransactions;

    private function book(Category $category, string $name): Product
    {
        $template = Product::query()->first();
        abort_unless($template, 500, 'The test database needs at least one product to copy.');

        $book = $template->replicate();
        $book->forceFill([
            'name' => $name,
            'slug' => \Illuminate\Support\Str::slug($name).'-'.uniqid(),
            'sku' => 'SHELF-'.uniqid(),
            'category_id' => $category->id,
            'is_active' => true,
        ])->save();

        return $book;
    }

    public function test_one_or_several_categories_can_be_asked_for(): void
    {
        $a = Category::create(['name' => 'Shelf Test A', 'slug' => 'shelf-test-a-'.uniqid()]);
        $b = Category::create(['name' => 'Shelf Test B', 'slug' => 'shelf-test-b-'.uniqid()]);
        $c = Category::create(['name' => 'Shelf Test C', 'slug' => 'shelf-test-c-'.uniqid()]);
        $this->book($a, 'Shelf Book A');
        $this->book($b, 'Shelf Book B');
        $this->book($c, 'Shelf Book C');

        $names = fn (string $query) => collect($this->getJson('/api/v1/products?per_page=100&category='.$query)->assertOk()->json('data'))->pluck('name')->sort()->values()->all();

        $this->assertSame(['Shelf Book A'], $names($a->slug));
        $this->assertSame(['Shelf Book A', 'Shelf Book B'], $names($a->slug.','.$b->slug));
        $this->assertSame(['Shelf Book B'], $names(' ,'.$b->slug.', no-such-category'));
    }
}
