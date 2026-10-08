<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminOrderController extends Controller
{
    public function index(Request $request)
    {
        $query = Order::with('items')->orderByDesc('placed_at');

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        if ($search = trim((string) $request->query('search'))) {
            $query->where(function ($q) use ($search) {
                $q->where('order_number', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('ship_name', 'like', "%{$search}%");
            });
        }

        $page = $query->paginate(20);

        return response()->json([
            'data' => collect($page->items())->map(fn (Order $o) => array_merge($o->toSummary(), [
                'customer' => $o->ship_name,
                'email' => $o->email,
                'payment_status' => $o->payment_status,
                // Shiprocket state, so the list can show the right next action.
                'shiprocket_order_id' => $o->shiprocket_order_id,
                'shiprocket_shipment_id' => $o->shiprocket_shipment_id,
                'awb_code' => $o->awb_code,
                'courier_name' => $o->courier_name,
                'tracking_url' => $o->tracking_url,
            ]))->values(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    public function show(Order $order)
    {
        return response()->json(['data' => $order->load('items.product.category')->toDetail()]);
    }

    public function updateStatus(Request $request, Order $order)
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(Order::STATUSES)],
            'payment_status' => ['nullable', Rule::in(['pending', 'paid', 'refunded'])],
        ]);

        $was = $order->status;
        $order->update(array_filter($data));

        // Stamp the delivery moment the first time it lands — it starts the
        // 7-day return window the customer's order page counts from.
        if ($order->status === 'delivered' && ! $order->delivered_at) {
            $order->forceFill(['delivered_at' => now()])->save();
        }

        // Tell the customer, but only if the status really moved.
        \App\Support\OrderNotifier::statusChanged($order, $was, $order->status);

        return response()->json(['data' => $order->fresh('items.product.category')->toDetail()]);
    }
}
