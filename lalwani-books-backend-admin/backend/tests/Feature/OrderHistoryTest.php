<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * My Account → Order history lists the books in each order, and only ever the
 * signed-in shopper's own orders.
 *
 * Runs inside a rolled-back transaction, so it needs an already-migrated
 * database (the default in-memory SQLite has no tables), e.g.:
 *   DB_CONNECTION=mysql DB_DATABASE=lalwani_books_test php artisan test --filter=OrderHistoryTest
 */
class OrderHistoryTest extends TestCase
{
    use DatabaseTransactions;

    private function order(User $user, array $books): Order
    {
        $order = Order::create([
            'order_number' => 'LBI-TEST-'.uniqid(),
            'user_id' => $user->id,
            'email' => $user->email,
            'status' => 'processing',
            'payment_method' => 'cod',
            'payment_status' => 'pending',
            'subtotal' => 100, 'discount' => 0, 'shipping' => 0, 'tax' => 0, 'total' => 100,
            'ship_name' => 'Asha Rao',
            'ship_phone' => '9876543210',
            'ship_address1' => '12 MG Road',
            'ship_city' => 'Bengaluru',
            'ship_state' => 'Karnataka',
            'ship_zip' => '560001',
            'ship_country' => 'India',
            'placed_at' => now(),
        ]);
        foreach ($books as [$product, $quantity]) {
            $order->items()->create([
                'product_id' => $product->id,
                'name' => $product->name,
                'unit_price' => $product->price,
                'quantity' => $quantity,
                'total' => $product->price * $quantity,
            ]);
        }

        return $order;
    }

    public function test_each_order_in_the_history_lists_its_books(): void
    {
        $user = User::factory()->create();
        $books = Product::query()->where('is_active', true)->orderBy('id')->take(4)->get();
        $this->assertCount(4, $books, 'the test database needs four live books');

        $order = $this->order($user, [[$books[0], 2], [$books[1], 1], [$books[2], 1], [$books[3], 1]]);
        // Someone else's order must never show up in this shopper's list.
        $this->order(User::factory()->create(), [[$books[0], 1]]);

        Sanctum::actingAs($user);
        $list = $this->getJson('/api/v1/orders')->assertOk()->json('data');

        $this->assertCount(1, $list);
        $row = $list[0];
        $this->assertSame($order->order_number, $row['order_number']);
        $this->assertSame(5, $row['items_count']);
        $this->assertSame(4, $row['lines_count']);
        // The first three books, each with enough to draw its cover.
        $this->assertCount(3, $row['items']);
        $this->assertSame($books[0]->name, $row['items'][0]['name']);
        $this->assertSame(2, $row['items'][0]['quantity']);
        $this->assertSame($books[0]->slug, $row['items'][0]['product']['slug']);
        $this->assertArrayHasKey('colors', $row['items'][0]['product']);
        $this->assertSame(['id', 'name', 'slug', 'author', 'image', 'colors'], array_keys($row['items'][0]['product']));
    }

    public function test_the_order_history_needs_a_signed_in_shopper(): void
    {
        $this->getJson('/api/v1/orders')->assertUnauthorized();
    }
}
