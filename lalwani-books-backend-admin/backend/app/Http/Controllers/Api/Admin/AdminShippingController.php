<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\Shiprocket;
use App\Support\GatewayCredentials;
use Illuminate\Http\Request;
use RuntimeException;

/** Shiprocket dispatch from the admin order screen. */
class AdminShippingController extends Controller
{
    public function status()
    {
        return response()->json(['data' => [
            'enabled' => Shiprocket::enabled(),
            // Same source Shiprocket::createOrder sends, not the env default —
            // reading config() here reported a stale value the moment an admin
            // changed the pickup location in the panel.
            'pickup_location' => GatewayCredentials::get('shiprocket_pickup_location', 'Primary'),
        ]]);
    }

    /** Push the order to Shiprocket. */
    public function push(Order $order)
    {
        abort_unless(Shiprocket::enabled(), 422, 'Shiprocket is not configured.');

        try {
            $res = Shiprocket::createOrder($order);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $order = $order->fresh();

        return response()->json([
            'message' => "Sent to Shiprocket as order {$order->shiprocket_order_id}. "
                .'Next, "Assign courier" books the pickup and gets the AWB.',
            'data' => $this->payload($order),
            'raw' => $res,
        ]);
    }

    /** Book a courier and get the AWB. */
    public function assign(Request $request, Order $order)
    {
        abort_unless(Shiprocket::enabled(), 422, 'Shiprocket is not configured.');

        $courierId = $request->integer('courier_id') ?: null;

        try {
            $res = Shiprocket::assignAwb($order, $courierId);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $order = $order->fresh();

        return response()->json([
            'message' => $order->awb_code
                ? "Courier assigned: {$order->courier_name}, AWB {$order->awb_code}."
                : 'Courier assigned.',
            'data' => $this->payload($order),
            'raw' => $res,
        ]);
    }

    /**
     * An AWB booked outside this panel — on Shiprocket's own site, say — typed
     * in by hand. It goes on the order with its tracking link, a pending order
     * becomes "processing", and every save emails the customer "your order
     * has been processed" with the number. One way per order: not for an
     * order already sent to Shiprocket from here.
     */
    public function manualAwb(Request $request, Order $order)
    {
        // A number copied with spaces in it ("1234 5678 9012") is still one number.
        if (is_string($request->input('awb_code'))) {
            $request->merge(['awb_code' => preg_replace('/\s+/', '', $request->input('awb_code'))]);
        }

        $data = $request->validate([
            'awb_code' => ['required', 'string', 'regex:/^[A-Za-z0-9][A-Za-z0-9-]{3,39}$/'],
            'courier_name' => ['nullable', 'string', 'max:80'],
        ], [
            'awb_code.required' => 'Enter the AWB number.',
            'awb_code.regex' => 'An AWB number is 4 to 40 letters or digits (dashes allowed).',
        ]);

        if ($order->status === 'cancelled') {
            return response()->json(['message' => 'This order was cancelled — it cannot be shipped.'], 422);
        }
        if ($order->shiprocket_order_id) {
            return response()->json([
                'message' => 'This order was sent to Shiprocket, so its courier is booked there with “Assign courier” — not by hand.',
            ], 422);
        }

        $awb = $data['awb_code'];
        $was = $order->status;

        $order->forceFill([
            'awb_code' => $awb,
            'courier_name' => $data['courier_name'] ?? null,
            'tracking_url' => 'https://shiprocket.co/tracking/'.rawurlencode($awb),
            'status' => $was === 'pending' ? 'processing' : $was,
        ])->save();

        $emailed = \App\Support\OrderNotifier::trackingAdded($order);

        return response()->json([
            'message' => "AWB {$awb} saved on order {$order->order_number}."
                .($was !== $order->status ? ' It is now Processing.' : '')
                .($emailed
                    ? " The email “Your order has been processed” is on its way to {$order->email}."
                    : ' No email: the order has no email address.'),
            'data' => $this->payload($order->fresh()),
        ]);
    }

    public function track(Order $order)
    {
        abort_unless(Shiprocket::enabled(), 422, 'Shiprocket is not configured.');

        if (! $order->awb_code) {
            return response()->json(['message' => 'No AWB on this order yet.'], 422);
        }

        return response()->json(['data' => Shiprocket::track($order->awb_code)]);
    }

    private function payload(Order $order): array
    {
        return [
            'shiprocket_order_id' => $order->shiprocket_order_id,
            'shiprocket_shipment_id' => $order->shiprocket_shipment_id,
            'awb_code' => $order->awb_code,
            'courier_name' => $order->courier_name,
            'tracking_url' => $order->tracking_url,
            'shipped_at' => optional($order->shipped_at)->toIso8601String(),
            'status' => $order->status,
        ];
    }
}
