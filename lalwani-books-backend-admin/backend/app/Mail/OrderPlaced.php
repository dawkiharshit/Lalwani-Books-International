<?php

namespace App\Mail;

use App\Models\Order;
use App\Models\Setting;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/** Order confirmation sent to the customer, and a copy to the shop. */
class OrderPlaced extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Order $order, public bool $forAdmin = false) {}

    public function envelope(): Envelope
    {
        $store = Setting::get('site_name', 'Lalwani Books International');

        return new Envelope(
            subject: $this->forAdmin
                ? "New order {$this->order->order_number} — {$store}"
                : "{$store} — order {$this->order->order_number} confirmed",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.order-placed',
            with: [
                'order' => $this->order->loadMissing('items'),
                'store' => Setting::get('site_name', 'Lalwani Books International'),
                'supportEmail' => Setting::get('support_email', ''),
                'forAdmin' => $this->forAdmin,
                'siteUrl' => (config('app.frontend_url') ?: rtrim((string) config('app.url'), '/')),
            ],
        );
    }
}
