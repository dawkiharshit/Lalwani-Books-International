<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Review;
use App\Models\Setting;
use App\Models\User;
use App\Support\GiftIdeas;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Admin → Products → Delete: a book the shop will not sell again goes for
 * good, and nothing that was already bought is disturbed.
 *
 * Runs inside a rolled-back transaction, so it needs an already-migrated
 * database (the default in-memory SQLite has no tables), e.g.:
 *   DB_CONNECTION=mysql DB_DATABASE=lalwani_books_test php artisan test --filter=ProductDeleteTest
 */
class ProductDeleteTest extends TestCase
{
    use DatabaseTransactions;

    private function owner(): User
    {
        $owner = User::factory()->create(['is_admin' => true]);
        Sanctum::actingAs($owner);

        return $owner;
    }

    private function book(array $extra = []): Product
    {
        $category = Category::first() ?? Category::create(['name' => 'Test Shelf', 'slug' => 'test-shelf-'.uniqid()]);

        return Product::create($extra + [
            'category_id' => $category->id,
            'name' => 'Delete Test Book '.uniqid(),
            'slug' => 'delete-test-'.uniqid(),
            'sku' => 'LBI-'.strtoupper(uniqid()),
            'description' => 'A book made by the delete test.',
            'price' => 199,
            'stock' => 4,
            'color_from' => '#042B52',
            'color_to' => '#0D4377',
            'accent' => '#E8B04B',
        ]);
    }

    public function test_a_book_and_the_things_that_hang_off_it_are_removed(): void
    {
        Storage::fake('public');
        $this->owner();
        $book = $this->book();

        // A cover and a gallery picture, as the admin panel uploads them.
        $cover = Storage::disk('public')->putFile('products', UploadedFile::fake()->image('cover.jpg'));
        $extra = Storage::disk('public')->putFile('products', UploadedFile::fake()->image('inside.jpg'));
        $book->update(['image' => 'storage/'.$cover]);
        $book->images()->create(['path' => 'storage/'.$extra, 'sort' => 1]);
        Review::create([
            'product_id' => $book->id,
            'name' => 'A Reader',
            'rating' => 5,
            'body' => 'Lovely.',
            'is_approved' => true,
        ]);

        $this->deleteJson("/api/v1/admin/products/{$book->id}")
            ->assertOk()
            ->assertJsonPath('message', "“{$book->name}” has been deleted.");

        $this->assertNull(Product::find($book->id));
        $this->assertSame(0, Review::where('product_id', $book->id)->count());
        Storage::disk('public')->assertMissing($cover);
        Storage::disk('public')->assertMissing($extra);
    }

    public function test_an_order_for_it_keeps_what_was_bought(): void
    {
        $this->owner();
        $book = $this->book();
        $order = Order::create([
            'order_number' => 'LBI-DEL-'.strtoupper(substr(uniqid(), -6)),
            'email' => 'buyer@example.test',
            'status' => 'delivered',
            'payment_method' => 'cod',
            'payment_status' => 'paid',
            'subtotal' => 199, 'discount' => 0, 'shipping' => 0, 'tax' => 0, 'total' => 199,
            'ship_name' => 'A Buyer',
            'ship_phone' => '+91 98100 00000',
            'ship_address1' => '1 Test Road',
            'ship_city' => 'Delhi',
            'ship_state' => 'Delhi',
            'ship_zip' => '110001',
            'ship_country' => 'India',
            'placed_at' => now(),
        ]);
        $item = OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $book->id,
            'name' => $book->name,
            'unit_price' => 199,
            'quantity' => 1,
            'total' => 199,
        ]);

        $this->deleteJson("/api/v1/admin/products/{$book->id}")->assertOk();

        $kept = OrderItem::find($item->id);
        $this->assertNotNull($kept, 'the order line must survive the book');
        $this->assertSame($book->name, $kept->name);
        $this->assertSame(199, (int) $kept->total);
        $this->assertNull($kept->product_id);
        $this->assertNotNull(Order::find($order->id));
    }

    public function test_the_home_page_stops_pointing_at_it(): void
    {
        $this->owner();
        $book = $this->book();
        GiftIdeas::mark($book->id, true);
        Setting::set('spotlight_product_slug', $book->slug);

        $this->deleteJson("/api/v1/admin/products/{$book->id}")->assertOk();

        $this->assertNotContains($book->id, GiftIdeas::ids());
        $this->assertSame('', (string) Setting::get('spotlight_product_slug'));
    }

    public function test_another_book_chosen_for_the_spotlight_is_left_alone(): void
    {
        $this->owner();
        $keep = $this->book();
        $going = $this->book();
        Setting::set('spotlight_product_slug', $keep->slug);

        $this->deleteJson("/api/v1/admin/products/{$going->id}")->assertOk();

        $this->assertSame($keep->slug, (string) Setting::get('spotlight_product_slug'));
    }

    public function test_only_someone_signed_in_can_delete(): void
    {
        $book = $this->book();

        $this->deleteJson("/api/v1/admin/products/{$book->id}")->assertUnauthorized();

        Sanctum::actingAs(User::factory()->create(['is_admin' => false]));
        $this->deleteJson("/api/v1/admin/products/{$book->id}")->assertForbidden();

        $this->assertNotNull(Product::find($book->id));
    }
}
