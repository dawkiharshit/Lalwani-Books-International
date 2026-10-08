<?php

namespace Tests\Feature;

use App\Mail\ReturnApproved;
use App\Models\Order;
use App\Models\ReturnRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Runs inside a rolled-back transaction, so it needs an already-migrated
 * database (the default in-memory SQLite has no tables), e.g.:
 *   DB_CONNECTION=mysql DB_DATABASE=lalwani_books_test php artisan test --filter=ReturnApprovedEmailTest
 */
class ReturnApprovedEmailTest extends TestCase
{
    use DatabaseTransactions;

    private function pendingReturn(string $type = 'refund', string $payment = 'razorpay', array $extra = []): ReturnRequest
    {
        $customer = User::factory()->create();
        $order = Order::create([
            'order_number' => 'LBI-TEST-'.uniqid(),
            'user_id' => $customer->id,
            'email' => 'buyer@example.test',
            'status' => 'delivered',
            'payment_method' => $payment,
            'payment_status' => $payment === 'cod' ? 'pending' : 'paid',
            'subtotal' => 100, 'discount' => 0, 'shipping' => 0, 'tax' => 18, 'total' => 118,
            'ship_name' => 'Asha Rao',
            'ship_phone' => '9876543210',
            'ship_address1' => '12 MG Road',
            'ship_city' => 'Bengaluru',
            'ship_state' => 'Karnataka',
            'ship_zip' => '560001',
            'ship_country' => 'India',
            'placed_at' => now(),
        ]);

        return ReturnRequest::create($extra + [
            'order_id' => $order->id,
            'user_id' => $customer->id,
            'type' => $type,
            'reason' => 'Damaged in transit',
            'items' => [['name' => 'Raw Honey Cleansing Bar', 'quantity' => 1, 'product_id' => null]],
            'status' => 'requested',
        ]);
    }

    public function test_completing_an_online_refund_emails_the_customer(): void
    {
        Mail::fake();
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));
        // No captured Razorpay payment id, so no live refund call is made.
        $return = $this->pendingReturn(extra: ['status' => 'approved']);

        $this->postJson("/api/v1/admin/returns/{$return->id}/complete", ['refund_amount' => 100])
            ->assertOk()
            ->assertJsonPath('message', 'Return completed and refunded. The customer has been emailed.');

        Mail::assertSent(\App\Mail\RefundProcessed::class, function ($mail) {
            $html = $mail->render();

            return $mail->hasTo('buyer@example.test')
                && str_contains($html, 'Your refund has been processed')
                && str_contains($html, '₹100.00')
                && str_contains($html, 'within 7 working days')
                && str_contains($html, 'Original payment method');
        });
    }

    public function test_cod_refund_email_names_the_payout_account_without_exposing_it(): void
    {
        $return = $this->pendingReturn('refund', 'cod', [
            'status' => 'completed',
            'refund_amount' => 1027.45,
            'refund_method' => 'bank',
            'refund_bank' => ['account_name' => 'Asha Rao', 'account_number' => '123456789012', 'ifsc' => 'HDFC0000001', 'bank_name' => 'HDFC Bank'],
        ]);

        $html = (new \App\Mail\RefundProcessed($return))->render();

        $this->assertStringContainsString('₹1,027.45', $html);
        $this->assertStringContainsString('HDFC Bank account ending 9012', $html);
        $this->assertStringContainsString('account you gave us within 7 working days', $html);
        // A COD order has no "original payment method" to go back to.
        $this->assertStringNotContainsString('original payment method', $html);
        $this->assertStringNotContainsString('123456789012', $html);

        $upi = $this->pendingReturn('refund', 'cod', [
            'status' => 'completed', 'refund_amount' => 50, 'refund_method' => 'upi', 'refund_upi' => 'asharao@okhdfc',
        ]);
        $html = (new \App\Mail\RefundProcessed($upi))->render();
        $this->assertStringContainsString('UPI as', $html);
        $this->assertStringContainsString('@okhdfc', $html);
        $this->assertStringNotContainsString('asharao@', $html);
    }

    public function test_completing_a_replacement_sends_no_refund_email(): void
    {
        Mail::fake();
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));
        $return = $this->pendingReturn('replacement', extra: ['status' => 'approved']);

        $this->postJson("/api/v1/admin/returns/{$return->id}/complete")->assertOk();

        Mail::assertNotSent(\App\Mail\RefundProcessed::class);
    }

    public function test_approving_a_return_emails_the_customer(): void
    {
        Mail::fake();
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));
        $return = $this->pendingReturn();

        $this->postJson("/api/v1/admin/returns/{$return->id}/approve", ['admin_note' => 'Sorry about that!'])
            ->assertOk()
            ->assertJsonPath('message', 'Return approved. The customer has been emailed.');

        Mail::assertSent(ReturnApproved::class, function (ReturnApproved $mail) {
            $html = $mail->render();

            return $mail->hasTo('buyer@example.test')
                && str_contains($html, 'Your return request is approved')
                && str_contains($html, 'Hi Asha')
                && str_contains($html, 'Sorry about that!')
                && str_contains($html, 'Raw Honey Cleansing Bar')
                && str_contains($html, 'process your refund to your original payment method')
                && str_contains($html, 'within 7 working days');
        });
    }

    public function test_cod_approval_email_promises_the_payout_account_not_the_payment_method(): void
    {
        $html = (new ReturnApproved($this->pendingReturn('refund', 'cod'), null))->render();

        $this->assertStringContainsString('process your refund to the UPI ID or bank account you gave us', $html);
        $this->assertStringContainsString('within 7 working days', $html);
        $this->assertStringNotContainsString('original payment method', $html);
    }

    public function test_replacement_wording_and_no_internal_errors_in_the_email(): void
    {
        $return = $this->pendingReturn('replacement');
        // What approve() leaves behind when the pickup couldn't be booked.
        $return->admin_note = 'Pickup not auto-booked: Shiprocket 401';

        $html = (new ReturnApproved($return, null))->render();

        $this->assertStringContainsString('send the replacement out', $html);
        $this->assertStringContainsString('arrange the pickup', $html);
        $this->assertStringNotContainsString('Shiprocket', $html);
    }

    public function test_a_mail_outage_does_not_undo_the_approval(): void
    {
        Mail::shouldReceive('to')->andThrow(new \RuntimeException('SMTP down'));
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));
        $return = $this->pendingReturn();

        $this->postJson("/api/v1/admin/returns/{$return->id}/approve")
            ->assertOk()
            ->assertJsonPath('message', 'Return approved. The customer could not be emailed.');

        $this->assertSame('approved', $return->fresh()->status);
    }
}
