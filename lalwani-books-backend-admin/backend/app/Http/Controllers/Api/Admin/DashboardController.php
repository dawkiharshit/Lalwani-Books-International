<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ContactMessage;
use App\Models\NewsletterSubscriber;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Review;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function stats()
    {
        // A cancelled order is not a sale, so it is excluded everywhere money
        // is counted — but it is still counted as an order.
        $sold = fn () => Order::where('status', '!=', 'cancelled');

        $revenue = (float) $sold()->sum('total');
        $ordersCount = Order::count();
        $paidOrdersCount = $sold()->count();

        $today = Carbon::today();

        $statusBreakdown = Order::query()
            ->select('status', DB::raw('COUNT(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status');

        $paymentSplit = Order::query()
            ->select('payment_method', DB::raw('COUNT(*) as orders'), DB::raw('SUM(total) as revenue'))
            ->where('status', '!=', 'cancelled')
            ->groupBy('payment_method')
            ->get()
            ->keyBy('payment_method');

        // COD money sits with the courier until it is remitted, so what is
        // still owed is worth seeing on its own.
        $codPending = (float) Order::where('payment_method', 'cod')
            ->where('payment_status', 'pending')
            ->where('status', '!=', 'cancelled')
            ->sum('total');

        return response()->json([
            'data' => [
                'revenue' => round($revenue, 2),
                'orders_count' => $ordersCount,
                'customers_count' => User::where('is_admin', false)->count(),
                'products_count' => Product::count(),
                'reviews_count' => Review::count(),
                'subscribers_count' => NewsletterSubscriber::count(),
                'unread_messages' => ContactMessage::where('is_read', false)->count(),

                // Sales over time
                'sales' => [
                    'today' => $this->sumBetween($today, $today->copy()->endOfDay()),
                    'yesterday' => $this->sumBetween(
                        $today->copy()->subDay(),
                        $today->copy()->subDay()->endOfDay()
                    ),
                    'week' => $this->sumBetween($today->copy()->startOfWeek(), now()),
                    'month' => $this->sumBetween($today->copy()->startOfMonth(), now()),
                    'year' => $this->sumBetween($today->copy()->startOfYear(), now()),
                ],

                // Orders waiting on someone
                'status_breakdown' => $statusBreakdown,

                // The single number that tells you whether the shop is growing
                'average_order_value' => $paidOrdersCount > 0
                    ? round($revenue / $paidOrdersCount, 2)
                    : 0.0,

                'payments' => [
                    'cod_orders' => (int) ($paymentSplit['cod']->orders ?? 0),
                    'cod_revenue' => round((float) ($paymentSplit['cod']->revenue ?? 0), 2),
                    'cod_uncollected' => round($codPending, 2),
                    'prepaid_orders' => (int) ($paymentSplit['razorpay']->orders ?? 0),
                    'prepaid_revenue' => round((float) ($paymentSplit['razorpay']->revenue ?? 0), 2),
                ],

                'stock' => [
                    // Out of stock is its own emergency — those are sales being
                    // lost right now, not a warning about next week.
                    'out_of_stock' => Product::active()->where('stock', '<=', 0)->count(),
                    'low_stock' => Product::active()
                        ->where('stock', '>', 0)
                        ->whereRaw('stock <= COALESCE(low_stock_threshold, ?)', [Product::DEFAULT_LOW_STOCK])
                        ->count(),
                ],

                'top_products' => OrderItem::query()
                    ->select('product_id', 'name', DB::raw('SUM(quantity) as sold'), DB::raw('SUM(total) as revenue'))
                    ->groupBy('product_id', 'name')
                    ->orderByDesc('sold')
                    ->limit(5)
                    ->get(),

                'recent_orders' => Order::with('items')
                    ->orderByDesc('placed_at')
                    ->limit(8)
                    ->get()
                    ->map(fn (Order $o) => array_merge($o->toSummary(), [
                        'customer' => $o->ship_name,
                        'email' => $o->email,
                    ])),
            ],
        ]);
    }

    /** Revenue placed inside a window, cancellations excluded. */
    private function sumBetween(Carbon $from, Carbon $to): float
    {
        return round((float) Order::where('status', '!=', 'cancelled')
            ->whereBetween('placed_at', [$from, $to])
            ->sum('total'), 2);
    }
}
