<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Setting;
use App\Models\User;
use App\Support\GiftIdeas;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The home page's Discover row: Bestsellers and Gift Ideas are chosen with
 * ticks in admin → Products. "Gift idea" is kept as a list in settings, not a
 * column; until a ticked book is on sale, hardcovers and bestsellers stand in.
 *
 *   DB_CONNECTION=mysql DB_DATABASE=lalwani_books_test php artisan test --filter=DiscoverShelvesTest
 */
class DiscoverShelvesTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        Setting::flush();
        $this->beforeApplicationDestroyed(fn () => Setting::flush());
        Setting::set(GiftIdeas::KEY, '');
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));
    }

    private function book(array $extra = []): array
    {
        $category = Category::first() ?? Category::create(['name' => 'Test Shelf', 'slug' => 'test-shelf-'.uniqid()]);

        return $extra + [
            'category_id' => $category->id,
            'name' => 'Discover Test Book '.uniqid(),
            'description' => 'A book made by the discover test.',
            'price' => 199,
            'stock' => 3,
            'binding' => 'Paperback',
            'color_from' => '#042B52',
            'color_to' => '#0D4377',
            'accent' => '#E8B04B',
        ];
    }

    private function create(array $extra = []): int
    {
        return $this->postJson('/api/v1/admin/products', $this->book($extra))->assertCreated()->json('data.id');
    }

    /** @return int[] */
    private function shelf(string $filter): array
    {
        return array_column($this->getJson("/api/v1/products?{$filter}=1&per_page=48")->assertOk()->json('data'), 'id');
    }

    public function test_books_ticked_as_gift_ideas_fill_the_shelf_until_unticked(): void
    {
        $gift = $this->create(['is_gift_idea' => true]);
        $other = $this->create();

        $this->assertSame([$gift], $this->shelf('gift'));
        $this->assertTrue($this->getJson("/api/v1/admin/products/{$gift}")->json('data.is_gift_idea'));
        $this->assertFalse($this->getJson("/api/v1/admin/products/{$other}")->json('data.is_gift_idea'));

        // Saving the book without the tick in the form leaves it on the list.
        $this->putJson("/api/v1/admin/products/{$gift}", $this->book(['name' => 'Renamed '.uniqid()]))->assertOk();
        $this->assertSame([$gift], $this->shelf('gift'));

        // Unticked: a paperback that is not a bestseller drops off the shelf.
        $this->putJson("/api/v1/admin/products/{$gift}", $this->book(['is_gift_idea' => false]))->assertOk();
        $this->assertFalse(GiftIdeas::has($gift));
        $this->assertNotContains($gift, $this->shelf('gift'));
    }

    public function test_with_no_gift_ideas_ticked_hardcovers_and_bestsellers_stand_in(): void
    {
        $hardcover = $this->create(['binding' => 'Hardcover']);
        $bestseller = $this->create(['is_bestseller' => true]);
        $plain = $this->create();

        $shelf = $this->shelf('gift');
        $this->assertContains($hardcover, $shelf);
        $this->assertContains($bestseller, $shelf);
        $this->assertNotContains($plain, $shelf);

        // The Bestseller tick also puts the book on the Bestsellers shelf.
        $this->assertContains($bestseller, $this->shelf('bestsellers'));
        $this->assertNotContains($plain, $this->shelf('bestsellers'));
    }

    public function test_a_ticked_book_taken_off_sale_lets_the_stand_ins_return(): void
    {
        $bestseller = $this->create(['is_bestseller' => true]);
        $gift = $this->create(['is_gift_idea' => true]);
        $this->deleteJson("/api/v1/admin/products/{$gift}")->assertOk();

        $shelf = $this->shelf('gift');
        $this->assertNotContains($gift, $shelf);
        $this->assertContains($bestseller, $shelf);
    }
}
