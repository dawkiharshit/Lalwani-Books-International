<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\Razorpay;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class PaymentController extends Controller
{
    /** What the checkout page needs to decide which payment options to show. */
    public function config()
    {
        return response()->json(['data' => [
            'razorpay_enabled' => Razorpay::enabled(),
            'razorpay_key_id' => Razorpay::enabled() ? Razorpay::keyId() : null,
            'cod_enabled' => CheckoutController::codEnabled(),
            'currency' => config('shop.currency_code', 'INR'),
            // What the gateway will actually accept, so the storefront can stop
            // advertising methods this account has switched off. Cached inside
            // the service; [] when the lookup fails or Razorpay is off.
            'methods' => Razorpay::enabledMethods(),
        ]]);
    }

    /**
     * Start a Razorpay payment for an order that already exists in our DB.
     * The order number is the handle — no ids are trusted from the browser.
     */
    public function start(Request $request)
    {
        $data = $request->validate([
            'order_number' => ['required', 'string', 'max:40'],
        ]);

        abort_unless(Razorpay::enabled(), 422, 'Online payment is not configured.');

        $order = Order::where('order_number', $data['order_number'])->firstOrFail();

        // This response carries the buyer's name, email and phone. A customer's
        // order is locked to that customer; a guest order (no owner) can be paid
        // by whoever holds its number — the only way a guest pays online.
        $user = $request->user('sanctum');
        if ($order->user_id !== null) {
            abort_unless($user && $order->user_id === $user->id, 403, 'This is not your order.');
        }

        if ($order->payment_status === 'paid') {
            return response()->json(['message' => 'This order is already paid.'], 422);
        }

        $rzp = Razorpay::createOrder($order);

        return response()->json(['data' => [
            'key_id' => Razorpay::keyId(),
            'razorpay_order_id' => $rzp['id'],
            'amount' => $rzp['amount'],
            'currency' => $rzp['currency'],
            'order_number' => $order->order_number,
            'name' => \App\Models\Setting::get('site_name', 'Lalwani Books International'),
            'prefill' => [
                'name' => $order->ship_name,
                'email' => $order->email,
                'contact' => $order->ship_phone,
            ],
        ]]);
    }

    /** Browser hands back the signed result; we re-derive the signature. */
    public function verify(Request $request)
    {
        $data = $request->validate([
            'razorpay_order_id' => ['required', 'string', 'max:64'],
            'razorpay_payment_id' => ['required', 'string', 'max:64'],
            'razorpay_signature' => ['required', 'string', 'max:128'],
        ]);

        $order = Order::where('razorpay_order_id', $data['razorpay_order_id'])->firstOrFail();

        if (! Razorpay::verifySignature(
            $data['razorpay_order_id'],
            $data['razorpay_payment_id'],
            $data['razorpay_signature']
        )) {
            Log::warning('Razorpay signature mismatch', ['order' => $order->order_number]);

            return response()->json(['message' => 'Payment could not be verified.'], 422);
        }

        Razorpay::markPaid($order, $data['razorpay_payment_id'], $data['razorpay_signature']);

        return response()->json(['data' => [
            'order_number' => $order->order_number,
            'payment_status' => $order->payment_status,
        ]]);
    }

    /**
     * Server-to-server backstop: if the customer closes the tab after paying,
     * the webhook still marks the order paid.
     */
    public function webhook(Request $request)
    {
        $raw = $request->getContent();
        $signature = (string) $request->header('X-Razorpay-Signature', '');

        if (! Razorpay::verifyWebhook($raw, $signature)) {
            return response()->json(['message' => 'Invalid signature.'], 400);
        }

        $event = $request->input('event');
        $payment = $request->input('payload.payment.entity', []);

        if ($event === 'payment.captured' && ! empty($payment['order_id'])) {
            $order = Order::where('razorpay_order_id', $payment['order_id'])->first();

            if ($order) {
                Razorpay::markPaid($order, (string) ($payment['id'] ?? ''));
            }
        }

        return response()->json(['ok' => true]);
    }
}
