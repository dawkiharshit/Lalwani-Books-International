<?php

namespace App\Support;

use App\Mail\OrderStatusChanged;
use App\Models\Order;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

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
    }

    /**
     * Never allowed to break the action that triggered it: the status is
     * already saved, and a mail outage must not undo that or return an error
     * to the admin.
     */
    private static function send(Order $order, string $status): void
    {
        if (! $order->email) {
            return;
        }

        try {
            Mail::to($order->email)->send(new OrderStatusChanged($order->fresh(), $status));
        } catch (Throwable $e) {
            Log::warning('Order status email failed', [
                'order' => $order->order_number,
                'status' => $status,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
