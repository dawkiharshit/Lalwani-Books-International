<?php

namespace App\Mail;

use App\Models\Order;
use App\Models\Setting;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Tells the customer their order moved — dispatched, delivered or cancelled.
 *
 * One mailable rather than three: the layout is identical and only the
 * headline, the sentence under it and the tracking block differ.
 */
class OrderStatusChanged extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Order $order, public string $status) {}

    public function envelope(): Envelope
    {
        $store = Setting::get('site_name', 'Lalwani Books International');
        $number = $this->order->order_number;

        return new Envelope(
            subject: match ($this->status) {
                'shipped' => "Your {$store} order is on its way — {$number}",
                'delivered' => "Your {$store} order has arrived — {$number}",
                'cancelled' => "Your {$store} order was cancelled — {$number}",
                default => "Update on your {$store} order — {$number}",
            },
        );
    }

    public function content(): Content
    {
        $order = $this->order->loadMissing('items');

        return new Content(
            view: 'emails.order-status',
            with: [
                'order' => $order,
                'status' => $this->status,
                'store' => Setting::get('site_name', 'Lalwani Books International'),
                'name' => explode(' ', trim((string) $order->ship_name))[0] ?: 'there',
                'headline' => match ($this->status) {
                    'shipped' => 'Your order is on its way',
                    'delivered' => 'Your order has arrived',
                    'cancelled' => 'Your order was cancelled',
                    default => 'Your order was updated',
                },
                'body' => match ($this->status) {
                    'shipped' => 'It left the atelier today. You can follow it with the courier below.',
                    'delivered' => 'We hope it arrived well. Wear it in good health.',
                    'cancelled' => 'Nothing will be shipped and nothing further will be charged.',
                    default => 'The status of your order has changed.',
                },
                'supportEmail' => Setting::get('support_email', ''),
            ],
        );
    }
}
