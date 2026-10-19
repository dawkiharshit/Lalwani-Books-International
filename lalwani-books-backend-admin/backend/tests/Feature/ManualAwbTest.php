<?php

namespace Tests\Feature;

use App\Mail\OrderStatusChanged;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Setting;
use App\Models\User;
use App\Support\StaffAccess;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Admin → Orders → "+ Add AWB": an AWB booked on Shiprocket's own site, typed
 * in by hand. It goes on the order with its tracking link and the customer is
 * emailed "your order has been processed" — without calling Shiprocket.
 *
 * Runs inside a rolled-back transaction, so it needs an already-migrated
 * database, e.g.:
 *   DB_CONNECTION=mysql DB_DATABASE=lalwani_books_test php artisan test --filter=ManualAwbTest
 */
class ManualAwbTest extends TestCase
{
    use DatabaseTransactions;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();

        Setting::flush();
        Http::preventStrayRequests();
        Mail::fake();
        Storage::fake('local');
        $this->owner = User::factory()->create(['is_admin' => true]);
        Sanctum::actingAs($this->owner);
    }

    protected function tearDown(): void
    {
        Setting::flush();

        parent::tearDown();
    }

    private function order(string $status = 'pending'): Order
    {
        $order = Order::create([
            'order_number' => 'LBI-AWB-'.strtoupper(uniqid()),
            'email' => 'buyer@example.test',
            'status' => $status,
            'payment_method' => 'cod',
            'payment_status' => 'pending',
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
        OrderItem::create(['order_id' => $order->id, 'name' => 'Malgudi Days', 'unit_price' => 349, 'quantity' => 1, 'total' => 349]);

        return $order;
    }

    private function addAwb(Order $order, array $body)
    {
        return $this->putJson("/api/v1/admin/orders/{$order->id}/awb", $body);
    }

    public function test_the_number_is_kept_and_the_customer_hears_the_order_was_processed(): void
    {
        $order = $this->order();

        $message = $this->addAwb($order, ['awb_code' => ' 1431 8420 012345 ', 'courier_name' => 'Delhivery'])
            ->assertOk()
            ->assertJsonPath('data.awb_code', '14318420012345')
            ->assertJsonPath('data.status', 'processing')
            ->json('message');
        $this->assertStringContainsString('has been processed', $message);
        $this->assertStringContainsString('now Processing', $message);

        $order->refresh();
        $this->assertSame('14318420012345', $order->awb_code);
        $this->assertSame('Delhivery', $order->courier_name);
        $this->assertSame('https://shiprocket.co/tracking/14318420012345', $order->tracking_url);
        $this->assertSame('processing', $order->status);
        $this->assertNull($order->shipped_at, 'Not shipped until the courier collects it.');

        Mail::assertSent(OrderStatusChanged::class, function (OrderStatusChanged $mail) use ($order) {
            $html = $mail->render();

            return $mail->hasTo('buyer@example.test')
                && $mail->status === 'processing'
                && str_contains($mail->envelope()->subject, 'has been processed')
                && str_contains($mail->envelope()->subject, $order->order_number)
                && str_contains($html, 'Your order has been processed')
                && str_contains($html, 'Delhivery &middot; AWB 14318420012345')
                && str_contains($html, 'href="https://shiprocket.co/tracking/14318420012345"')
                && str_contains($html, 'Track your parcel');
        });

        // The customer's own order page shows it too.
        $this->assertSame('14318420012345', $order->toDetail()['shipment']['awb_code']);
    }

    public function test_every_save_emails_the_customer_even_with_the_same_number(): void
    {
        $order = $this->order('processing');

        $first = $this->addAwb($order, ['awb_code' => 'SR123456'])->assertOk()->json('message');
        $this->assertStringContainsString('on its way to buyer@example.test', $first);
        $this->addAwb($order, ['awb_code' => 'SR123456', 'courier_name' => 'Ekart'])->assertOk();
        $this->assertSame('Ekart', $order->fresh()->courier_name);
        Mail::assertSentCount(2);

        $this->addAwb($order, ['awb_code' => 'SR654321', 'courier_name' => 'Ekart'])->assertOk();
        Mail::assertSentCount(3);
        Mail::assertSent(OrderStatusChanged::class, fn ($mail) => str_contains($mail->render(), 'SR654321'));
    }

    public function test_shipped_and_delivered_orders_are_emailed_too_and_cancelled_ones_refused(): void
    {
        $shipped = $this->order('shipped');
        $this->addAwb($shipped, ['awb_code' => 'XB9988776655'])->assertOk()->assertJsonPath('data.status', 'shipped');

        $delivered = $this->order('delivered');
        $this->addAwb($delivered, ['awb_code' => 'DL55555'])->assertOk()->assertJsonPath('data.status', 'delivered');

        Mail::assertSentCount(2);
        foreach (['XB9988776655', 'DL55555'] as $awb) {
            Mail::assertSent(OrderStatusChanged::class, fn ($mail) => $mail->status === 'processing'
                && $mail->hasTo('buyer@example.test')
                && str_contains($mail->render(), 'AWB '.$awb));
        }

        $cancelled = $this->order('cancelled');
        $this->addAwb($cancelled, ['awb_code' => 'CN11111'])->assertStatus(422);
        $this->assertNull($cancelled->fresh()->awb_code);
        Mail::assertSentCount(2);
    }

    public function test_one_way_per_order_shiprocket_or_a_number_typed_in(): void
    {
        // Sent to Shiprocket: its courier is booked there, not typed in.
        $withShiprocket = $this->order();
        $withShiprocket->forceFill(['shiprocket_order_id' => '998877', 'shiprocket_shipment_id' => '665544'])->save();
        $message = $this->addAwb($withShiprocket, ['awb_code' => 'HAND12345'])->assertStatus(422)->json('message');
        $this->assertStringContainsString('Assign courier', $message);
        $this->assertNull($withShiprocket->fresh()->awb_code);
        Mail::assertNothingSent();

        // A number typed in: the order is never sent to Shiprocket as well
        // (refused before any call — stray requests would fail the test).
        \App\Support\GatewayCredentials::set('shiprocket_email', 'api-user@example.test');
        \App\Support\GatewayCredentials::set('shiprocket_password', 'api-user-password');
        $byHand = $this->order();
        $this->addAwb($byHand, ['awb_code' => 'HAND12345'])->assertOk();
        $refused = $this->postJson("/api/v1/admin/orders/{$byHand->id}/shiprocket")->assertStatus(422)->json('message');
        $this->assertStringContainsString('added by hand', $refused);
        $this->assertNull($byHand->fresh()->shiprocket_order_id);
    }

    public function test_odd_numbers_are_refused_and_the_courier_is_escaped_in_the_email(): void
    {
        $order = $this->order();
        foreach (['', 'AB1', '12<script>', str_repeat('9', 41), '-12345'] as $bad) {
            $this->addAwb($order, ['awb_code' => $bad])->assertStatus(422)->assertJsonValidationErrors('awb_code');
        }
        $this->addAwb($order, ['awb_code' => ['12345']])->assertStatus(422);
        $this->addAwb($order, ['awb_code' => '12345', 'courier_name' => str_repeat('x', 81)])->assertStatus(422);
        $this->assertNull($order->fresh()->awb_code);
        Mail::assertNothingSent();

        $this->addAwb($order, ['awb_code' => 'AB-12345', 'courier_name' => '<b>Fast</b> & Co'])->assertOk();
        Mail::assertSent(OrderStatusChanged::class, function ($mail) {
            $html = $mail->render();

            return str_contains($html, '&lt;b&gt;Fast&lt;/b&gt; &amp; Co') && ! str_contains($html, '<b>Fast</b>');
        });
    }

    public function test_staff_need_the_orders_area_and_a_held_number_is_emailed_once_approved(): void
    {
        $order = $this->order();

        Sanctum::actingAs(User::factory()->create());
        $this->addAwb($order, ['awb_code' => 'ST12345'])->assertForbidden();

        $viewer = User::factory()->create(['name' => 'View Staff']);
        StaffAccess::save($viewer->id, ['areas' => ['orders' => StaffAccess::VIEW]]);
        Sanctum::actingAs($viewer);
        $this->addAwb($order, ['awb_code' => 'ST12345'])->assertForbidden();

        $helper = User::factory()->create(['name' => 'Packing Staff']);
        StaffAccess::save($helper->id, ['areas' => ['orders' => StaffAccess::APPROVAL]]);
        Sanctum::actingAs($helper);
        $this->addAwb($order, ['awb_code' => 'ST12345', 'courier_name' => 'DTDC'])
            ->assertStatus(202)
            ->assertJsonPath('pending_approval', true);
        $this->assertNull($order->fresh()->awb_code);
        Mail::assertNothingSent();

        Sanctum::actingAs($this->owner);
        $waiting = $this->getJson('/api/v1/admin/approvals')->assertOk()->json('data.0');
        $this->assertSame("Add AWB ST12345 to order {$order->order_number}", $waiting['title']);
        $this->assertContains('AWB number', array_column($waiting['fields'], 'label'));

        $this->postJson("/api/v1/admin/approvals/{$waiting['id']}/approve")->assertOk();
        $this->assertSame('ST12345', $order->fresh()->awb_code);
        $this->assertSame('processing', $order->fresh()->status);
        Mail::assertSent(OrderStatusChanged::class, fn ($mail) => $mail->status === 'processing' && $mail->hasTo('buyer@example.test'));
    }
}
