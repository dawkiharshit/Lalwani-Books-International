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
            ->assertJsonPath('message', 'Return completed and refunded. The customer is being emailed.');

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
            ->assertJsonPath('message', 'Return approved. The customer is being emailed.');

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
        \App\Models\Setting::flush();
        Mail::shouldReceive('to')->andThrow(new \RuntimeException('SMTP down'));
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));
        $return = $this->pendingReturn();

        // The email goes after the answer, so the answer can't know it failed…
        $this->postJson("/api/v1/admin/returns/{$return->id}/approve")
            ->assertOk()
            ->assertJsonPath('message', 'Return approved. The customer is being emailed.');

        $this->assertSame('approved', $return->fresh()->status);
        // …but admin → Email (SMTP) lists it, with the address half hidden.
        $problem = \App\Support\MailLater::recentFailures()[0];
        $this->assertSame('Return approval', $problem['what']);
        $this->assertSame('bu•••@example.test', $problem['to']);
        $this->assertSame('SMTP down', $problem['error']);
        $this->getJson('/api/v1/admin/integrations/mail')
            ->assertJsonPath('data.problems.0.what', 'Return approval');
        // Never on the return itself: customers see its note on their order page.
        $this->assertStringNotContainsString('SMTP', (string) $return->fresh()->admin_note);
    }

    /** Two books (₹60 + ₹40), ₹10 off, ₹18 tax: total ₹108. */
    private function twoBookOrderReturning(array $items): ReturnRequest
    {
        $return = $this->pendingReturn(extra: ['items' => $items]);
        $return->order->forceFill(['subtotal' => 100, 'discount' => 10, 'tax' => 18, 'shipping' => 0, 'total' => 108])->save();
        \App\Models\OrderItem::create(['order_id' => $return->order_id, 'name' => 'Godaan', 'unit_price' => 60, 'quantity' => 1, 'total' => 60]);
        \App\Models\OrderItem::create(['order_id' => $return->order_id, 'name' => 'Malgudi Days', 'unit_price' => 40, 'quantity' => 1, 'total' => 40]);

        return $return->fresh();
    }

    public function test_the_approval_email_tells_the_customer_the_refund_amount(): void
    {
        Mail::fake();
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));
        $return = $this->pendingReturn();

        $this->postJson("/api/v1/admin/returns/{$return->id}/approve", ['refund_amount' => 99.5])->assertOk();

        $this->assertSame(99.5, $return->fresh()->refund_amount);
        Mail::assertSent(ReturnApproved::class, function (ReturnApproved $mail) {
            $html = $mail->render();

            return str_contains($html, 'Refund amount')
                && str_contains($html, '₹99.50')
                && str_contains($html, 'process your refund of ₹99.50 to your original payment method');
        });
    }

    public function test_the_suggested_refund_is_the_whole_total_or_the_returned_books_share(): void
    {
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));
        $everything = $this->twoBookOrderReturning([
            ['name' => 'Godaan', 'quantity' => 1], ['name' => 'Malgudi Days', 'quantity' => 1],
        ]);
        // One ₹40 book of ₹100: ₹40 − ₹4 of the discount + ₹7.20 of the tax.
        $oneBook = $this->twoBookOrderReturning([['name' => 'Malgudi Days', 'quantity' => 1]]);

        $this->assertSame(108.0, $everything->suggestedRefund());
        $this->assertSame(43.2, $oneBook->suggestedRefund());

        $rows = collect($this->getJson('/api/v1/admin/returns')->assertOk()->json('data'))->keyBy('id');
        $this->assertEquals(43.2, $rows[$oneBook->id]['suggested_refund']);
    }

    public function test_approving_without_an_amount_uses_the_suggestion_and_completing_refunds_it(): void
    {
        Mail::fake();
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));
        $return = $this->twoBookOrderReturning([['name' => 'Malgudi Days', 'quantity' => 1]]);

        $this->postJson("/api/v1/admin/returns/{$return->id}/approve")->assertOk();
        $this->assertSame(43.2, $return->fresh()->refund_amount);

        // Completed with the amount box left empty: the amount the customer was told.
        $this->postJson("/api/v1/admin/returns/{$return->id}/complete")->assertOk();

        $this->assertSame(43.2, $return->fresh()->refund_amount);
        Mail::assertSent(\App\Mail\RefundProcessed::class, fn ($mail) => str_contains($mail->render(), '₹43.20'));
    }

    public function test_a_refund_above_the_order_total_cannot_be_promised(): void
    {
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));
        $return = $this->pendingReturn();

        $this->postJson("/api/v1/admin/returns/{$return->id}/approve", ['refund_amount' => 500])
            ->assertStatus(422)
            ->assertJsonValidationErrors('refund_amount');

        $this->assertSame('requested', $return->fresh()->status);
    }
}
