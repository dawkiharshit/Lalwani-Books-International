<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\ReturnRequest;
use App\Models\Setting;
use App\Models\User;
use App\Support\GatewayCredentials;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Completing a prepaid return refunds through Razorpay. Razorpay pays refunds
 * from the money still in the Razorpay account, and when that is less than the
 * refund it answers only "invalid request sent". The shop checks the balance
 * first and tells the admin plainly. Razorpay is faked: no request leaves.
 *
 *   DB_CONNECTION=mysql DB_DATABASE=lalwani_books_test php artisan test --filter=RazorpayRefundTest
 */
class RazorpayRefundTest extends TestCase
{
    use DatabaseTransactions;

    private const PAYMENT = 'pay_RefundTest0001';

    protected function setUp(): void
    {
        parent::setUp();

        Http::preventStrayRequests();
        Mail::fake();
        GatewayCredentials::set('razorpay_key_id', 'rzp_test_refundtest');
        GatewayCredentials::set('razorpay_key_secret', 'refund-test-secret');
        // The settings map is memoised for the process; forget the fake keys
        // once this test's rows are rolled back.
        $this->beforeApplicationDestroyed(fn () => Setting::flush());
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));
    }

    private function approvedReturn(float $total = 498): ReturnRequest
    {
        $customer = User::factory()->create();
        $order = Order::create([
            'order_number' => 'LBI-TEST-'.uniqid(),
            'user_id' => $customer->id,
            'email' => 'buyer@example.test',
            'status' => 'delivered',
            'payment_method' => 'razorpay',
            'payment_status' => 'paid',
            'subtotal' => $total, 'discount' => 0, 'shipping' => 0, 'tax' => 0, 'total' => $total,
            'ship_name' => 'Asha Rao',
            'ship_phone' => '9876543210',
            'ship_address1' => '12 MG Road',
            'ship_city' => 'Bengaluru',
            'ship_state' => 'Karnataka',
            'ship_zip' => '560001',
            'ship_country' => 'India',
            'placed_at' => now(),
        ]);
        $order->forceFill(['razorpay_payment_id' => self::PAYMENT, 'paid_at' => now()])->save();

        return ReturnRequest::create([
            'order_id' => $order->id,
            'user_id' => $customer->id,
            'type' => 'refund',
            'reason' => 'Damaged in transit',
            'items' => [['name' => 'A book', 'quantity' => 1, 'product_id' => null]],
            'status' => 'approved',
        ]);
    }

    /** A captured ₹498 payment, the account balance given, and a refund that would succeed. */
    private function fakeRazorpay(?int $balance, array $refundReply = ['id' => 'rfnd_Test0001', 'amount' => 49800, 'status' => 'processed'], int $refundStatus = 200): void
    {
        Http::fake([
            'api.razorpay.com/v1/payments/'.self::PAYMENT.'/refund' => Http::response($refundReply, $refundStatus),
            'api.razorpay.com/v1/payments/'.self::PAYMENT => Http::response(['id' => self::PAYMENT, 'amount' => 49800, 'amount_refunded' => 0, 'status' => 'captured']),
            'api.razorpay.com/v1/balance' => $balance === null
                ? Http::response(['error' => ['description' => 'not available']], 500)
                : Http::response(['balance' => $balance, 'refund_credits' => 0]),
        ]);
    }

    public function test_a_refund_bigger_than_the_razorpay_balance_is_stopped_with_a_clear_reason(): void
    {
        // ₹498 paid, ₹11.76 fee taken, everything else already settled to the bank.
        $this->fakeRazorpay(48624);
        $return = $this->approvedReturn();

        $message = $this->postJson("/api/v1/admin/returns/{$return->id}/complete", ['refund_amount' => 498])
            ->assertStatus(422)->json('message');

        $this->assertStringContainsString('₹498.00', $message);
        $this->assertStringContainsString('only ₹486.24 is left in your Razorpay account', $message);
        Http::assertNotSent(fn (Request $r) => str_ends_with($r->url(), '/refund'));
        $this->assertSame('approved', $return->fresh()->status);
        $this->assertSame('paid', $return->order->fresh()->payment_status);
    }

    public function test_a_refund_the_balance_covers_goes_through(): void
    {
        $this->fakeRazorpay(150000);
        $return = $this->approvedReturn();

        $this->postJson("/api/v1/admin/returns/{$return->id}/complete", ['refund_amount' => 498])->assertOk();

        Http::assertSent(fn (Request $r) => str_ends_with($r->url(), '/payments/'.self::PAYMENT.'/refund')
            && $r['amount'] === 49800 && $r['speed'] === 'normal');
        $return->refresh();
        $this->assertSame('completed', $return->status);
        $this->assertSame('rfnd_Test0001', $return->refund_id);
        $this->assertEquals(498, $return->refund_amount);
        $this->assertSame('refunded', $return->order->fresh()->payment_status);
    }

    public function test_razorpays_catch_all_refusal_is_explained(): void
    {
        // The balance can't be read, so the refund is tried — and refused.
        $this->fakeRazorpay(null, ['error' => ['code' => 'BAD_REQUEST_ERROR', 'description' => 'invalid request sent']], 400);
        $return = $this->approvedReturn();

        $message = $this->postJson("/api/v1/admin/returns/{$return->id}/complete", ['refund_amount' => 498])
            ->assertStatus(422)->json('message');

        $this->assertStringContainsString('without giving a reason', $message);
        $this->assertStringContainsString('balance', $message);
        $this->assertStringNotContainsString('invalid request sent', $message);
        $this->assertSame('approved', $return->fresh()->status);
    }

    public function test_razorpays_specific_reasons_are_still_shown(): void
    {
        $this->fakeRazorpay(150000, ['error' => ['code' => 'BAD_REQUEST_ERROR', 'description' => 'The payment has been fully refunded already']], 400);
        $return = $this->approvedReturn();

        $this->postJson("/api/v1/admin/returns/{$return->id}/complete", ['refund_amount' => 498])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Razorpay: The payment has been fully refunded already');
    }
}
