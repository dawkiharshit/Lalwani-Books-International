<?php

namespace App\Mail;

use App\Models\Order;
use App\Models\ReturnRequest;
use App\Models\Setting;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Tells the customer their refund has gone out: how much, and where to look
 * for it. Wording matches the return card on their order page.
 */
class RefundProcessed extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public ReturnRequest $return) {}

    public function envelope(): Envelope
    {
        $store = Setting::get('site_name', 'Lalwani Books International');
        $number = $this->return->order?->order_number;

        return new Envelope(
            subject: "Your {$store} refund has been processed — {$number}",
        );
    }

    public function content(): Content
    {
        $return = $this->return->loadMissing('order');
        $order = $return->order;
        $amount = '₹'.number_format((float) $return->refund_amount, 2);
        $cod = $order?->payment_method === 'cod';

        return new Content(
            view: 'emails.refund-processed',
            with: [
                'return' => $return,
                'order' => $order,
                'store' => Setting::get('site_name', 'Lalwani Books International'),
                'name' => explode(' ', trim((string) $order?->ship_name))[0] ?: 'there',
                'amount' => $amount,
                // Both say by when, as the order page does: online orders are
                // reversed to how they paid, COD is paid to the account given.
                'when' => $cod
                    ? 'It should reach the account you gave us within '.Order::REFUND_DAYS.' working days.'
                    : 'It should reach your original payment method within '.Order::REFUND_DAYS.' working days.',
                'destination' => $cod ? $this->destination($return) : 'Original payment method',
                'supportEmail' => Setting::get('support_email', ''),
            ],
        );
    }

    /** Where a COD refund was sent, with the identifying part hidden. */
    private function destination(ReturnRequest $return): string
    {
        if ($return->refund_upi) {
            [$user, $host] = array_pad(explode('@', $return->refund_upi, 2), 2, '');
            $shown = mb_substr($user, 0, 2).str_repeat('•', max(mb_strlen($user) - 2, 2));

            return 'UPI '.$shown.($host !== '' ? '@'.$host : '');
        }

        $bank = $return->refund_bank ?? [];
        if (! empty($bank['account_number'])) {
            return trim(($bank['bank_name'] ?? 'Bank').' account ending '.substr($bank['account_number'], -4));
        }

        return 'The account you gave us';
    }
}
