<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\InvoiceBuilder;
use Illuminate\Http\Request;

class InvoiceController extends Controller
{
    /** A customer may only ever pull the invoice for their own order. */
    public function show(Request $request, string $orderNumber)
    {
        $order = Order::where('order_number', $orderNumber)->firstOrFail();

        abort_unless($order->user_id === $request->user()->id, 403);

        return response()->json(['data' => InvoiceBuilder::build($order)]);
    }

    /** Admin can pull any order's invoice. */
    public function adminShow(Order $order)
    {
        return response()->json(['data' => InvoiceBuilder::build($order)]);
    }
}
