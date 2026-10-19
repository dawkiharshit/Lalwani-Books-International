<?php

namespace App\Mail;

use App\Models\ReturnRequest;
use App\Models\Setting;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Tells the customer their return or replacement request was approved, and
 * what happens next. Same layout as the order-status email.
 */
class ReturnApproved extends Mailable
{
    use Queueable, SerializesModels;

    /** $note is only what the admin typed — never the internal pickup error. */
    public function __construct(public ReturnRequest $return, public ?string $note = null) {}

    public function envelope(): Envelope
    {
        $store = Setting::get('site_name', 'Lalwani Books International');
        $number = $this->return->order?->order_number;

        return new Envelope(
            subject: "Your {$store} return request is approved — {$number}",
        );
    }

    public function content(): Content
    {
        $return = $this->return->loadMissing('order');
        $order = $return->order;
        $replacement = $return->type === 'replacement';
        // The refund agreed when it was approved, as the refund email writes it.
        $amount = ! $replacement && $return->refund_amount
            ? '₹'.number_format((float) $return->refund_amount, 2)
            : null;

        return new Content(
            view: 'emails.return-approved',
            with: [
                'return' => $return,
                'order' => $order,
                'store' => Setting::get('site_name', 'Lalwani Books International'),
                'name' => explode(' ', trim((string) $order?->ship_name))[0] ?: 'there',
                'kind' => $replacement ? 'Replacement' : 'Refund',
                'pickupBooked' => (bool) $return->sr_return_shipment_id,
                'amount' => $amount,
                'body' => $replacement
                    ? 'Good news — we have approved your replacement request. Once the item is back with us, we will send the replacement out.'
                    : 'Good news — we have approved your return request. Once the item is back with us and checked, we will process your refund'
                        .($amount ? ' of '.$amount : '').' to '
                        .($order?->payment_method === 'cod' ? 'the UPI ID or bank account you gave us' : 'your original payment method')
                        .', and it should reach you within '.\App\Models\Order::REFUND_DAYS.' working days.',
                'note' => trim((string) $this->note),
                'supportEmail' => Setting::get('support_email', ''),
            ],
        );
    }
}
