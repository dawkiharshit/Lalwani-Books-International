<?php

namespace App\Support;

use App\Mail\OrderStatusChanged;
use App\Models\Order;

/**
 * Emails the customer when their order actually moves.
 *
 * Status changes in two places — an admin editing it by hand, and Shiprocket
 * flipping it to shipped when a courier is booked — so the decision of
 * whether to send lives here rather than in either of them.
 */
class OrderNotifier
{
    /** Statuses worth an email. Pending and processing are noise. */
    private const ANNOUNCED = ['shipped', 'delivered', 'cancelled'];

    /**
     * Send only when the status genuinely changed, so re-saving an order that
     * is already shipped does not mail the customer again.
     */
    public static function statusChanged(Order $order, ?string $from, string $to): void
    {
        if ($from === $to || ! in_array($to, self::ANNOUNCED, true)) {
            return;
        }

        self::send($order, $to);

        // The same moment on WhatsApp, through AiGrowBot when it is connected.
        \App\Services\AiGrowBot::notify('order.'.$to, \App\Services\AiGrowBot::orderData($order->fresh()));
    }

    /**
     * A tracking number (AWB) put on the order by hand: the customer is emailed
     * that their order has been processed, with the number and the link to
     * follow it — each time the admin saves it, whatever the order's status
     * (a cancelled order takes no AWB). True when an email is on its way.
     */
    public static function trackingAdded(Order $order): bool
    {
        if (! $order->email || ! $order->awb_code || $order->status === 'cancelled') {
            return false;
        }

        self::send($order, 'processing');

        return true;
    }

    /**
     * Sent once the admin (or Shiprocket) has their answer, and never allowed
     * to break the action that triggered it: the status is already saved, and
     * a mail outage must not undo that or return an error to the admin.
     */
    private static function send(Order $order, string $status): void
    {
        if (! $order->email) {
            return;
        }

        MailLater::send($order->email, new OrderStatusChanged($order->fresh(), $status), 'Order status', [
            'order' => $order->order_number,
            'status' => $status,
        ]);
    }
}
