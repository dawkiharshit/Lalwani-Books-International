<?php

namespace App\Services;

use App\Models\Order;
use App\Support\GatewayCredentials;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Razorpay Orders + payment verification.
 *
 * Talks to the REST API directly rather than pulling the SDK — the only two
 * things needed are an authenticated POST and an HMAC check, and skipping the
 * dependency keeps deployment to "fill in two env vars".
 */
class Razorpay
{
    private const API = 'https://api.razorpay.com/v1';

    public static function enabled(): bool
    {
        return self::keyId() !== '' && self::secret() !== '';
    }

    public static function keyId(): string
    {
        return GatewayCredentials::get('razorpay_key_id');
    }

    private static function secret(): string
    {
        return GatewayCredentials::get('razorpay_key_secret');
    }

    /**
     * Which payment methods this Razorpay account will actually accept.
     *
     * The storefront advertises logos next to "Pay securely with", and those
     * were hard-coded — so the shop promised Paytm on an account where the
     * wallet was never enabled, and a customer picking it would have found
     * nothing. Razorpay publishes the real list per key, so ask rather than
     * guess.
     *
     * Cached for an hour: it changes only when someone toggles a method in the
     * Razorpay dashboard, and this is read on every checkout and product page.
     * On any failure it returns [] and the caller falls back, because a
     * decorative strip must never be able to break checkout.
     *
     * @return array{upi: bool, netbanking: bool, wallets: array<int, string>, card_networks: array<int, string>}|array{}
     */
    public static function enabledMethods(): array
    {
        if (! self::enabled()) {
            return [];
        }

        return Cache::remember('razorpay_methods_'.md5(self::keyId()), 3600, function (): array {
            try {
                // Public endpoint — the key id is already in the browser.
                $res = Http::acceptJson()->timeout(8)
                    ->get(self::API.'/methods', ['key_id' => self::keyId()]);

                if (! $res->successful()) {
                    return [];
                }

                $d = $res->json();

                // Each of these is either a bool or a map of id => 1|0.
                $on = static fn ($v): array => is_array($v) ? array_keys(array_filter($v)) : [];

                return [
                    'upi' => (bool) ($d['upi'] ?? false),
                    'netbanking' => ! empty($on($d['netbanking'] ?? null)),
                    'wallets' => $on($d['wallet'] ?? null),
                    'card_networks' => ! empty($d['card'])
                        ? $on($d['card_networks'] ?? null)
                        : [],
                ];
            } catch (\Throwable $e) {
                Log::warning('Razorpay methods lookup failed', ['error' => $e->getMessage()]);

                return [];
            }
        });
    }

    /**
     * Create the Razorpay order that the checkout modal is opened against.
     * Amount is sent in paise, as the API requires.
     */
    public static function createOrder(Order $order): array
    {
        $res = Http::withBasicAuth(self::keyId(), self::secret())
            ->acceptJson()
            ->timeout(20)
            ->post(self::API.'/orders', [
                'amount' => (int) round($order->total * 100),
                'currency' => config('shop.currency_code', 'INR'),
                'receipt' => $order->order_number,
                'notes' => [
                    'order_number' => $order->order_number,
                    'email' => (string) $order->email,
                ],
            ]);

        if (! $res->successful()) {
            Log::error('Razorpay order create failed', ['body' => $res->body()]);
            throw new RuntimeException('Could not start the payment. Please try again.');
        }

        $data = $res->json();
        $order->forceFill(['razorpay_order_id' => $data['id']])->save();

        return $data;
    }

    /**
     * Verify the signature the browser hands back. Razorpay signs
     * "<order_id>|<payment_id>" with the key secret.
     */
    public static function verifySignature(string $razorpayOrderId, string $paymentId, string $signature): bool
    {
        $expected = hash_hmac('sha256', $razorpayOrderId.'|'.$paymentId, self::secret());

        return hash_equals($expected, $signature);
    }

    /** Webhook bodies are signed with a separate secret over the raw payload. */
    public static function verifyWebhook(string $rawBody, string $signature): bool
    {
        $secret = GatewayCredentials::get('razorpay_webhook_secret');

        if ($secret === '' || $signature === '') {
            return false;
        }

        return hash_equals(hash_hmac('sha256', $rawBody, $secret), $signature);
    }

    /**
     * Refund a captured online payment — the whole amount, or a part of it in
     * rupees. Only works for an order that actually paid through Razorpay; a
     * COD order has nothing here to reverse and is refunded by hand.
     */
    public static function refund(Order $order, ?float $amount = null): array
    {
        if ($order->payment_status !== 'paid' || ! $order->razorpay_payment_id) {
            throw new RuntimeException('This order has no captured online payment to refund.');
        }

        // Look at the payment first. Refunding more than is left — because of a
        // double-click, a partial refund done earlier, or a manual refund in the
        // dashboard — must never be asked for. Knowing what is still refundable
        // on the payment lets us never over-ask.
        $wantPaise = $amount !== null ? (int) round($amount * 100) : null;
        $payment = Http::withBasicAuth(self::keyId(), self::secret())
            ->acceptJson()->timeout(20)
            ->get(self::API.'/payments/'.$order->razorpay_payment_id);

        if ($payment->successful()) {
            $refundable = (int) $payment->json('amount', 0) - (int) $payment->json('amount_refunded', 0);

            if ($refundable <= 0) {
                // The money is already back. Report it as done rather than
                // failing, so the return can still be closed out.
                return ['id' => null, 'amount' => (int) $payment->json('amount_refunded', 0), 'already_refunded' => true];
            }

            // Never ask for more than what remains.
            $wantPaise = $wantPaise === null ? $refundable : min($wantPaise, $refundable);
        }

        // Razorpay pays refunds out of the money still held in the Razorpay
        // account. Just after a settlement to the bank that can be less than
        // the refund — e.g. only this order's own payment, minus Razorpay's
        // fee — and Razorpay then refuses with the same "invalid request sent".
        // Check first, so the admin is told what is actually wrong.
        $available = self::refundBalance();
        if ($available !== null && $wantPaise !== null && $wantPaise > $available) {
            throw new RuntimeException(sprintf(
                'Razorpay can\'t refund ₹%s yet: only ₹%s is left in your Razorpay account, and Razorpay pays refunds from that balance (earlier payments have already been sent to your bank). Add funds in the Razorpay Dashboard, or wait for new orders to come in, then try again.',
                number_format($wantPaise / 100, 2),
                number_format(max(0, $available) / 100, 2)
            ));
        }

        $body = ['speed' => 'normal'];
        if ($wantPaise !== null) {
            $body['amount'] = $wantPaise; // paise
        }

        $res = Http::withBasicAuth(self::keyId(), self::secret())
            ->acceptJson()
            ->timeout(20)
            ->post(self::API.'/payments/'.$order->razorpay_payment_id.'/refund', $body);

        if (! $res->successful()) {
            Log::error('Razorpay refund failed', ['order' => $order->order_number, 'body' => $res->body()]);
            // Surface Razorpay's own reason ("The payment has been fully
            // refunded already", etc.) instead of a dead-end "check the dashboard"
            // — except its catch-all, which says nothing an admin can act on.
            $reason = $res->json('error.description');
            if (is_string($reason) && strcasecmp(trim($reason), 'invalid request sent') === 0) {
                throw new RuntimeException('Razorpay refused the refund without giving a reason. This usually means your Razorpay balance is too low to cover it (Razorpay pays refunds from that balance). Check your balance in the Razorpay Dashboard, then try again.');
            }
            throw new RuntimeException($reason ? 'Razorpay: '.$reason : 'Refund could not be processed — check the Razorpay dashboard.');
        }

        return $res->json() ?? [];
    }

    /**
     * What the Razorpay account can pay refunds from right now, in paise: its
     * balance plus any refund credits. Null when Razorpay doesn't say, in
     * which case the refund is simply attempted.
     */
    private static function refundBalance(): ?int
    {
        try {
            $res = Http::withBasicAuth(self::keyId(), self::secret())
                ->acceptJson()->timeout(15)
                ->get(self::API.'/balance');

            if (! $res->successful() || ! is_numeric($res->json('balance'))) {
                return null;
            }

            return (int) $res->json('balance') + (int) $res->json('refund_credits', 0);
        } catch (\Throwable $e) {
            Log::warning('Razorpay balance lookup failed', ['error' => $e->getMessage()]);

            return null;
        }
    }

    /** Mark the order paid — safe to call twice (webhook + browser can race). */
    public static function markPaid(Order $order, string $paymentId, ?string $signature = null): void
    {
        if ($order->payment_status === 'paid') {
            return;
        }

        $order->forceFill([
            'payment_status' => 'paid',
            'razorpay_payment_id' => $paymentId,
            'razorpay_signature' => $signature,
            'paid_at' => now(),
            'status' => $order->status === 'pending' ? 'processing' : $order->status,
        ])->save();
    }
}
