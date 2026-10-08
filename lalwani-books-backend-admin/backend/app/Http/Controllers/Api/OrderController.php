<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class OrderController extends Controller
{
    public function index(Request $request)
    {
        // The books ride along (with their category, which a card names) so
        // the list can show what each order was without one query per row.
        $orders = $request->user()->orders()
            ->with('items.product.category')
            ->orderByDesc('placed_at')
            ->paginate(10);

        return response()->json([
            'data' => collect($orders->items())->map(fn (Order $o) => $o->toSummary() + [
                // How many different books, for "+ 2 more" beside the first title.
                'lines_count' => $o->items->count(),
                // The first three, with just enough of each book to draw its cover.
                'items' => $o->items->take(3)->map(fn (OrderItem $item) => [
                    'id' => $item->id,
                    'name' => $item->name,
                    'quantity' => $item->quantity,
                    'product' => $item->product
                        ? Arr::only($item->product->toCard(), ['id', 'name', 'slug', 'author', 'image', 'colors'])
                        : null,
                ])->values(),
            ])->values(),
            'meta' => [
                'current_page' => $orders->currentPage(),
                'last_page' => $orders->lastPage(),
                'total' => $orders->total(),
            ],
        ]);
    }

    public function show(Request $request, string $orderNumber)
    {
        $order = $request->user()->orders()
            ->with('items.product.category')
            ->where('order_number', $orderNumber)
            ->firstOrFail();

        return response()->json(['data' => $order->toDetail()]);
    }

    /**
     * Customer-side cancellation. Only allowed while nothing has shipped, and
     * the stock that was reserved at checkout goes back to the shelf.
     */
    public function cancel(Request $request, string $orderNumber)
    {
        $data = $request->validate([
            "reason" => ["nullable", "string", "max:190"],
        ]);

        $order = Order::where("order_number", $orderNumber)->firstOrFail();

        abort_unless($order->user_id === $request->user()->id, 403);

        if (in_array($order->status, ["shipped", "delivered", "cancelled"], true)) {
            return response()->json([
                "message" => $order->status === "cancelled"
                    ? "This order is already cancelled."
                    : "This order has already been dispatched — please contact us instead.",
            ], 422);
        }

        // Handed to the courier already: self-service cancelling here would
        // leave a live pickup booked at Shiprocket that nobody knows about.
        if ($order->shiprocket_order_id) {
            return response()->json([
                "message" => "This order is already with our courier — please contact us and we will cancel it for you.",
            ], 422);
        }

        DB::transaction(function () use ($order, $data) {
            foreach ($order->items as $item) {
                if ($item->product) {
                    $item->product->increment("stock", $item->quantity);
                }
            }

            $order->forceFill([
                "status" => "cancelled",
                "cancelled_at" => now(),
                "cancel_reason" => $data["reason"] ?? null,
            ])->save();
        });

        \App\Support\OrderNotifier::statusChanged($order, "processing", "cancelled");

        return response()->json([
            "message" => "Order cancelled.",
            "data" => $order->fresh("items.product.category")->toDetail(),
        ]);
    }

    public function track(Request $request)
    {
        $data = $request->validate([
            'order_number' => ['required', 'string', 'max:30'],
            'email' => ['required', 'email'],
        ]);

        $order = Order::with('items.product.category')
            ->where('order_number', strtoupper(trim($data['order_number'])))
            ->where('email', strtolower(trim($data['email'])))
            ->first();

        if (! $order) {
            return response()->json(['message' => 'No order found for that number and email.'], 404);
        }

        return response()->json(['data' => $order->toDetail()]);
    }
}
