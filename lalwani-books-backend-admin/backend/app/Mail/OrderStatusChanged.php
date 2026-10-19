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
 * Tells the customer their order moved — processed (a courier booked, with
 * its tracking number), dispatched, delivered or cancelled.
 *
 * One mailable rather than four: the layout is identical and only the
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
                'processing' => "Your {$store} order has been processed — {$number}",
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
                    'processing' => 'Your order has been processed',
                    'shipped' => 'Your order is on its way',
                    'delivered' => 'Your order has arrived',
                    'cancelled' => 'Your order was cancelled',
                    default => 'Your order was updated',
                },
                'body' => match ($this->status) {
                    'processing' => 'Your order has been processed and a courier has been booked for it. Its tracking number is below — use the link to follow your parcel.',
                    'shipped' => 'It has left our shop and is on its way to you.',
                    'delivered' => 'We hope it arrived safely. Happy reading!',
                    'cancelled' => 'Nothing will be shipped and nothing further will be charged.',
                    default => 'The status of your order has changed.',
                },
                'supportEmail' => Setting::get('support_email', ''),
            ],
        );
    }
}
