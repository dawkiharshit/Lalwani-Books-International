<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\ReturnRequest;
use App\Models\Setting;
use App\Models\User;
use App\Support\GatewayCredentials;
use App\Support\ReturnPickupProblems;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * A return whose courier pickup could not be booked: admin → Returns says
 * why, and the customer's order page never shows Shiprocket's words.
 *
 * Runs inside a rolled-back transaction, so it needs an already-migrated
 * database (the default in-memory SQLite has no tables), e.g.:
 *   DB_CONNECTION=mysql DB_DATABASE=lalwani_books_test php artisan test --filter=ReturnPickupPrivacyTest
 */
class ReturnPickupPrivacyTest extends TestCase
{
    use DatabaseTransactions;

    private User $customer;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        Setting::flush();
        Http::preventStrayRequests();
        Mail::fake();
        $this->customer = User::factory()->create();
        $this->admin = User::factory()->create(['is_admin' => true]);

        // Shiprocket is set up but the shop's return address is not, so the
        // booking fails before anything is sent to Shiprocket.
        GatewayCredentials::set('shiprocket_email', 'api-user@example.test');
        GatewayCredentials::set('shiprocket_password', 'api-user-password');
        GatewayCredentials::set('shiprocket_pickup_pin', '');
        foreach (['return_address', 'return_city', 'return_state', 'return_pincode', 'invoice_address', 'contact_address', 'invoice_state'] as $key) {
            Setting::set($key, '');
        }
    }

    protected function tearDown(): void
    {
        Setting::flush();

        parent::tearDown();
    }

    private function returnRequest(array $extra = []): ReturnRequest
    {
        $order = Order::create([
            'order_number' => 'LBI-TEST-'.uniqid(),
            'user_id' => $this->customer->id,
            'email' => 'buyer@example.test',
            'status' => 'delivered',
            'payment_method' => 'cod',
            'payment_status' => 'paid',
            'subtotal' => 349, 'discount' => 0, 'shipping' => 0, 'tax' => 0, 'total' => 349,
            'ship_name' => 'Asha Rao',
            'ship_phone' => '9876543210',
            'ship_address1' => '12 MG Road',
            'ship_city' => 'Bengaluru',
            'ship_state' => 'Karnataka',
            'ship_zip' => '560001',
            'ship_country' => 'India',
            'placed_at' => now()->subDays(4),
            'delivered_at' => now()->subDay(),
        ]);

        return ReturnRequest::create($extra + [
            'order_id' => $order->id,
            'user_id' => $this->customer->id,
            'type' => 'replacement',
            'reason' => 'Damaged in transit',
            'items' => [['name' => 'Malgudi Days', 'quantity' => 1]],
            'status' => 'requested',
        ]);
    }

    /** The return as the customer's order page receives it. */
    private function customerSees(ReturnRequest $return): array
    {
        Sanctum::actingAs($this->customer);

        return $this->getJson('/api/v1/orders/'.$return->order->order_number)->assertOk()->json('data.return');
    }

    /** The return as admin → Returns receives it. */
    private function adminSees(ReturnRequest $return): array
    {
        Sanctum::actingAs($this->admin);

        return collect($this->getJson('/api/v1/admin/returns')->assertOk()->json('data'))->firstWhere('id', $return->id);
    }

    public function test_the_admin_sees_why_the_pickup_failed_and_the_customer_does_not(): void
    {
        $return = $this->returnRequest();

        Sanctum::actingAs($this->admin);
        $answer = $this->postJson("/api/v1/admin/returns/{$return->id}/approve", ['admin_note' => 'Please keep the book packed.'])
            ->assertOk()
            ->assertJsonPath('data.admin_note', 'Please keep the book packed.')
            ->json('data');
        $this->assertStringContainsString('return address is missing', $answer['pickup_problem']);

        $customer = $this->customerSees($return);
        $this->assertSame('Please keep the book packed.', $customer['admin_note']);
        $this->assertArrayNotHasKey('pickup_problem', $customer);
        $this->assertStringNotContainsString('return address', json_encode($customer));

        $this->assertStringContainsString('return address is missing', $this->adminSees($return)['pickup_problem']);
        $this->assertSame('Please keep the book packed.', $return->fresh()->admin_note);
        Http::assertNothingSent();
    }

    public function test_an_older_note_carrying_the_error_is_split_for_both_sides(): void
    {
        $return = $this->returnRequest([
            'status' => 'approved',
            'admin_note' => 'Please keep the book packed. — Pickup not auto-booked: Shiprocket 401 Unauthorized',
        ]);
        $onlyError = $this->returnRequest([
            'status' => 'approved',
            'admin_note' => 'Pickup not auto-booked: Shiprocket 401 Unauthorized',
        ]);

        $this->assertSame('Please keep the book packed.', $this->customerSees($return)['admin_note']);
        $this->assertNull($this->customerSees($onlyError)['admin_note']);

        $admin = $this->adminSees($return);
        $this->assertSame('Please keep the book packed.', $admin['admin_note']);
        $this->assertSame('Shiprocket 401 Unauthorized', $admin['pickup_problem']);
    }

    public function test_booking_the_pickup_later_clears_the_problem_and_keeps_the_note(): void
    {
        $return = $this->returnRequest([
            'status' => 'approved',
            'admin_note' => 'Please keep the book packed. — Pickup not auto-booked: Shiprocket 401 Unauthorized',
        ]);
        ReturnPickupProblems::set($return->id, 'Shiprocket 401 Unauthorized');

        // The return address is in now, and Shiprocket books the pickup.
        foreach (['return_address' => '7 Daryaganj', 'return_city' => 'New Delhi', 'return_state' => 'Delhi', 'return_pincode' => '110002', 'return_phone' => '9811111111'] as $key => $value) {
            Setting::set($key, $value);
        }
        Http::fake([
            '*/auth/login' => Http::response(['token' => 'test-token']),
            '*/orders/create/return' => Http::response(['order_id' => 777001, 'shipment_id' => 888001]),
        ]);

        Sanctum::actingAs($this->admin);
        $this->postJson("/api/v1/admin/returns/{$return->id}/book-pickup")
            ->assertOk()
            ->assertJsonPath('data.pickup_booked', true)
            ->assertJsonPath('data.pickup_problem', null)
            ->assertJsonPath('data.admin_note', 'Please keep the book packed.');

        $this->assertNull(ReturnPickupProblems::get($return->id));
        $this->assertSame('Please keep the book packed.', $return->fresh()->admin_note);
    }
}
