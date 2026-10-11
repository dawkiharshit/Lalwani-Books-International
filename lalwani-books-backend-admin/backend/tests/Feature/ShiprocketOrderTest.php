<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\User;
use App\Support\GatewayCredentials;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * "Send to Shiprocket" on the admin Orders screen, against a faked Shiprocket.
 *
 * Runs inside a rolled-back transaction, so it needs an already-migrated
 * database (the default in-memory SQLite has no tables), e.g.:
 *   DB_CONNECTION=mysql DB_DATABASE=lalwani_books_test php artisan test --filter=ShiprocketOrderTest
 */
class ShiprocketOrderTest extends TestCase
{
    use DatabaseTransactions;

    private Order $order;

    protected function setUp(): void
    {
        parent::setUp();

        Http::preventStrayRequests();
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));
        GatewayCredentials::set('shiprocket_email', 'api-user@example.test');
        GatewayCredentials::set('shiprocket_password', 'api-user-password');
        GatewayCredentials::set('shiprocket_pickup_location', 'Primary');

        $this->order = Order::create([
            'order_number' => 'LBI-TEST-'.uniqid(),
            'email' => 'buyer@example.test',
            'status' => 'processing',
            'payment_method' => 'razorpay',
            'payment_status' => 'paid',
            'subtotal' => 349, 'discount' => 0, 'shipping' => 0, 'tax' => 0, 'total' => 349,
            'ship_name' => 'Asha Rao',
            'ship_phone' => '+91 98765 43210',
            'ship_address1' => '12 MG Road',
            'ship_city' => 'New Delhi',
            'ship_state' => 'Delhi',
            'ship_zip' => '110044',
            'ship_country' => 'India',
            'placed_at' => now(),
        ]);
        OrderItem::create([
            'order_id' => $this->order->id,
            'name' => 'Malgudi Days',
            'unit_price' => 349,
            'quantity' => 1,
            'total' => 349,
        ]);
    }

    private function push()
    {
        return $this->postJson("/api/v1/admin/orders/{$this->order->id}/shiprocket");
    }

    /** The bug: a 200 without an order id passed as "sent" and nothing reached Shiprocket. */
    public function test_an_unknown_pickup_nickname_is_reported_not_passed_as_sent(): void
    {
        Http::fake([
            '*/auth/login' => Http::response(['token' => 'test-token']),
            '*/orders/create/adhoc' => Http::response([
                'message' => 'Wrong Pickup location entered. Please choose one location from data given',
                'data' => ['data' => [['pickup_location' => 'work']]],
            ], 200),
            '*/settings/company/pickup' => Http::response(['data' => ['shipping_address' => [['pickup_location' => 'work']]]]),
        ]);

        $message = $this->push()->assertStatus(422)->json('message');

        $this->assertStringContainsString('"Primary"', $message);
        $this->assertStringContainsString('"work"', $message);
        $this->assertNull($this->order->fresh()->shiprocket_order_id);
    }

    public function test_a_created_order_is_saved_and_confirmed(): void
    {
        GatewayCredentials::set('shiprocket_pickup_location', 'work');
        Http::fake([
            '*/auth/login' => Http::response(['token' => 'test-token']),
            '*/orders/create/adhoc' => Http::response(['order_id' => 111222, 'shipment_id' => 333444, 'status' => 'NEW', 'status_code' => 1]),
        ]);

        $res = $this->push()->assertOk();

        $this->assertEquals(333444, $res->json('data.shiprocket_shipment_id'));
        $this->assertSame(
            'Sent to Shiprocket as order 111222. Next, "Assign courier" books the pickup and gets the AWB.',
            $res->json('message')
        );

        Http::assertSent(fn ($request) => str_ends_with($request->url(), '/orders/create/adhoc')
            && $request['pickup_location'] === 'work'
            && $request['billing_phone'] === '9876543210');
        $this->assertSame('111222', (string) $this->order->fresh()->shiprocket_order_id);
    }

    /**
     * The bug behind the owner's "token_expired": Shiprocket ended the cached
     * token early and the store kept sending it for the rest of its 9 days.
     */
    public function test_an_expired_token_signs_in_again_and_the_order_still_goes(): void
    {
        GatewayCredentials::set('shiprocket_pickup_location', 'work');
        Http::fake([
            '*/auth/login' => Http::sequence()
                ->push(['token' => 'old-token'])
                ->push(['token' => 'new-token']),
            '*/orders/create/adhoc' => Http::sequence()
                ->push(['message' => 'token_expired', 'status_code' => 401], 401)
                ->push(['order_id' => 555666, 'shipment_id' => 777888, 'status' => 'NEW', 'status_code' => 1]),
        ]);

        $this->push()->assertOk();

        $this->assertSame('555666', (string) $this->order->fresh()->shiprocket_order_id);
        Http::assertSentCount(4); // login, refused create, login again, create
        Http::assertSent(fn ($request) => str_ends_with($request->url(), '/orders/create/adhoc')
            && $request->hasHeader('Authorization', 'Bearer new-token'));
    }

    public function test_the_fresh_token_is_kept_for_the_next_call(): void
    {
        Mail::fake(); // booking a courier emails the customer
        GatewayCredentials::set('shiprocket_pickup_location', 'work');
        Http::fake([
            '*/auth/login' => Http::sequence()
                ->push(['token' => 'old-token'])
                ->push(['token' => 'new-token']),
            '*/orders/create/adhoc' => Http::sequence()
                ->push(['message' => 'token_expired'], 401)
                ->push(['order_id' => 1, 'shipment_id' => 2]),
            '*/courier/assign/awb' => Http::response(['response' => ['data' => ['awb_code' => 'AWB123', 'courier_name' => 'Delhivery']]]),
        ]);

        $this->push()->assertOk();
        $this->postJson("/api/v1/admin/orders/{$this->order->id}/shiprocket/awb")->assertOk();

        // No third login: the courier booking reused the token from the re-login.
        Http::assertSentCount(5);
        Http::assertSent(fn ($request) => str_ends_with($request->url(), '/courier/assign/awb')
            && $request->hasHeader('Authorization', 'Bearer new-token'));
    }

    public function test_a_token_refused_even_after_signing_in_again_says_what_to_check(): void
    {
        Http::fake([
            '*/auth/login' => Http::response(['token' => 'any-token']),
            '*/orders/create/adhoc' => Http::response(['message' => 'token_expired'], 401),
        ]);

        $message = $this->push()->assertStatus(422)->json('message');

        $this->assertStringContainsString('even after signing in again', $message);
        $this->assertStringContainsString('admin → Delivery press "Test Shiprocket login"', $message);
        Http::assertSentCount(4); // tried once more, then stopped
        $this->assertNull($this->order->fresh()->shiprocket_order_id);
    }
}
