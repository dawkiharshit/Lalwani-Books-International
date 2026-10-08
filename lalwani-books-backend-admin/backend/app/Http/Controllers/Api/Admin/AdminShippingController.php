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
