<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Admin → Products: finding books by the day they were listed.
 *
 * Runs inside a rolled-back transaction, so it needs an already-migrated
 * database (the default in-memory SQLite has no tables), e.g.:
 *   DB_CONNECTION=mysql DB_DATABASE=lalwani_books_test php artisan test --filter=ProductListFilterTest
 */
class ProductListFilterTest extends TestCase
{
    use DatabaseTransactions;

    /** A book listed at an exact moment (given in UTC, as the database holds it). */
    private function listedAt(string $name, string $utc): Product
    {
        $category = Category::first() ?? Category::create(['name' => 'Test Shelf', 'slug' => 'test-shelf-'.uniqid()]);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => $name,
            'slug' => 'listed-'.uniqid(),
            'sku' => 'LBI-'.strtoupper(uniqid()),
            'description' => 'A book made by the listing-date test.',
            'price' => 199,
            'stock' => 2,
            'color_from' => '#042B52',
            'color_to' => '#0D4377',
            'accent' => '#E8B04B',
        ]);

        $product->forceFill(['created_at' => $utc, 'updated_at' => $utc])->save();

        return $product;
    }

    /** @return string[] the names the admin list came back with */
    private function names(array $query): array
    {
        $wanted = array_column(
            $this->getJson('/api/v1/admin/products?'.http_build_query($query + ['search' => 'Listing Test']))
                ->assertOk()
                ->json('data'),
            'name'
        );

        return $wanted;
    }

    public function test_books_can_be_found_by_the_day_they_were_listed(): void
    {
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));
        $this->listedAt('Listing Test March', '2026-03-05 09:00:00');
        $this->listedAt('Listing Test April', '2026-04-20 09:00:00');
        $this->listedAt('Listing Test May', '2026-05-11 09:00:00');

        // One day on its own.
        $this->assertSame(['Listing Test April'], $this->names(['listed_from' => '2026-04-20', 'listed_to' => '2026-04-20']));

        // Between two days, both of them counted.
        $this->assertEqualsCanonicalizing(
            ['Listing Test March', 'Listing Test April'],
            $this->names(['listed_from' => '2026-03-05', 'listed_to' => '2026-04-20'])
        );

        // From a day onwards, and up to a day.
        $this->assertSame(['Listing Test May'], $this->names(['listed_from' => '2026-05-01']));
        $this->assertSame(['Listing Test March'], $this->names(['listed_to' => '2026-03-31']));

        // Dates the wrong way round still mean the range between them.
        $this->assertSame(['Listing Test April'], $this->names(['listed_from' => '2026-04-20', 'listed_to' => '2026-04-19']));
    }

    public function test_a_day_runs_from_midnight_in_india_not_in_utc(): void
    {
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));
        // 1:30am on 11 March in India is still 10 March by UTC, which the
        // database stores. The shop listed it on the 11th and looks for it there.
        $this->listedAt('Listing Test Dawn', '2026-03-10 20:00:00');

        $this->assertSame(['Listing Test Dawn'], $this->names(['listed_from' => '2026-03-11', 'listed_to' => '2026-03-11']));
        $this->assertSame([], $this->names(['listed_from' => '2026-03-10', 'listed_to' => '2026-03-10']));
    }

    public function test_the_list_can_be_ordered_newest_or_oldest_first(): void
    {
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));
        $this->listedAt('Listing Test Older', '2026-02-01 09:00:00');
        $this->listedAt('Listing Test Newer', '2026-02-09 09:00:00');

        $this->assertSame(['Listing Test Newer', 'Listing Test Older'], $this->names(['sort' => 'newest']));
        $this->assertSame(['Listing Test Older', 'Listing Test Newer'], $this->names(['sort' => 'oldest']));
    }

    public function test_a_date_that_is_not_a_date_is_refused(): void
    {
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));

        $this->getJson('/api/v1/admin/products?listed_from=last-tuesday')->assertStatus(422);
        $this->getJson('/api/v1/admin/products?sort=price')->assertStatus(422);
    }
}
