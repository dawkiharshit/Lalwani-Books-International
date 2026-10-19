<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AbandonedCheckout;
use App\Models\Cart;
use App\Models\Coupon;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

class CheckoutController extends Controller
{
    // Rupee defaults — overridable from admin → Social & Contact.
    public const FREE_SHIPPING_THRESHOLD = 4999.0;
    public const FLAT_SHIPPING = 149.0;
    // Printed books (HSN 4901) are GST-exempt in India, so the default is 0.
    // Set a rate in admin → Shipping & Tax if taxable items are ever sold.
    public const TAX_RATE = 0.0;
    // Cash on delivery is on unless the admin turns it off.
    public const COD_ENABLED_DEFAULT = '1';

    /** Whether cash on delivery is currently offered. */
    public static function codEnabled(): bool
    {
        return (string) \App\Models\Setting::get('cod_enabled', self::COD_ENABLED_DEFAULT) === '1';
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:190'],
            'ship_name' => ['required', 'string', 'max:120'],
            // The courier needs a real 10-digit Indian mobile. Without this a
            // typo sails through, the order is paid for, and Shiprocket only
            // rejects it days later at dispatch.
            'ship_phone' => ['required', 'string', 'max:30', new \App\Rules\IndianMobile],
            'ship_address1' => ['required', 'string', 'max:190'],
            'ship_address2' => ['nullable', 'string', 'max:190'],
            'ship_city' => ['required', 'string', 'max:120'],
            'ship_state' => ['required', 'string', 'max:120'],
            'ship_zip' => ['required', 'string', 'max:20'],
            'ship_country' => ['nullable', 'string', 'max:60'],
            'payment_method' => ['required', 'in:cod,razorpay'],
            'coupon_code' => ['nullable', 'string', 'max:40'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        // Enforce the chosen method server-side. Hiding a button is not enough:
        // the browser can still post either value, so a disabled method must be
        // refused here too.
        if ($data['payment_method'] === 'cod' && ! self::codEnabled()) {
            abort(422, 'Cash on delivery is not available right now.');
        }
        if ($data['payment_method'] === 'razorpay' && ! \App\Services\Razorpay::enabled()) {
            abort(422, 'Online payment is not available right now.');
        }

        $user = $request->user('sanctum');
        $cart = $this->findCart($request, $user);

        if (! $cart || $cart->items()->count() === 0) {
            return response()->json(['message' => 'Your cart is empty.'], 422);
        }

        $order = DB::transaction(function () use ($data, $cart, $user) {
            $cart->load('items.product');

            $subtotal = 0;
            $lines = [];

            foreach ($cart->items as $item) {
                $product = Product::where('id', $item->product_id)->lockForUpdate()->first();

                if (! $product || ! $product->is_active) {
                    continue;
                }

                if ($product->stock < $item->quantity) {
                    abort(422, "Only {$product->stock} left of {$product->name}.");
                }

                $lineTotal = round($product->price * $item->quantity, 2);
                $subtotal += $lineTotal;

                $lines[] = [
                    'product' => $product,
                    'quantity' => $item->quantity,
                    'unit_price' => $product->price,
                    'total' => $lineTotal,
                ];
            }

            if (empty($lines)) {
                abort(422, 'Your cart is empty.');
            }

            $subtotal = round($subtotal, 2);
            $discount = 0;
            $couponCode = null;

            if (! empty($data['coupon_code'])) {
                $coupon = Coupon::where('code', strtoupper(trim($data['coupon_code'])))->lockForUpdate()->first();

                if (! $coupon) {
                    abort(422, 'Invalid coupon code.');
                }

                [$valid, $error] = $coupon->isValidFor($subtotal);
                if (! $valid) {
                    abort(422, $error);
                }

                $discount = $coupon->discountFor($subtotal);
                $couponCode = $coupon->code;
                $coupon->increment('used_count');
            }

            $taxRate = (float) \App\Models\Setting::get('tax_rate', self::TAX_RATE);
            $shippableBase = max($subtotal - $discount, 0);

            // The very same call the checkout page quoted from, so the figure
            // the customer agreed to is the figure they are charged.
            $shipping = \App\Support\ShippingQuote::for(
                $shippableBase,
                \App\Support\ShippingQuote::cartWeightKg($cart),
                $data['ship_zip'] ?? null,
                $data['payment_method'] === 'cod',
            )['charge'];
            // Shipping charged to the customer is part of the value of supply
            // under GST, so it is taxed with the goods. Leaving it out made the
            // invoice contradict itself: it printed "18%" beside a taxable
            // value that included shipping, while only the goods were taxed.
            $taxableValue = round($shippableBase + $shipping, 2);
            $tax = round($taxableValue * $taxRate, 2);
            $total = round($taxableValue + $tax, 2);

            $order = Order::create(array_merge($data, [
                'order_number' => $this->generateOrderNumber(),
                // Guests check out too: a signed-in customer's id ties the order
                // to them, a guest order simply has none.
                'user_id' => $user?->id,
                'status' => 'pending',
                // Never trust the browser for this: only a verified Razorpay
                // signature (or the webhook) may flip an order to paid.
                'payment_status' => 'pending',
                'subtotal' => $subtotal,
                'discount' => $discount,
                'shipping' => $shipping,
                'tax' => $tax,
                'total' => $total,
                'coupon_code' => $couponCode,
                "ship_country" => $data["ship_country"] ?? "India",
                'placed_at' => now(),
            ]));

            foreach ($lines as $line) {
                $order->items()->create([
                    'product_id' => $line['product']->id,
                    'name' => $line['product']->name,
                    'unit_price' => $line['unit_price'],
                    'quantity' => $line['quantity'],
                    'total' => $line['total'],
                ]);

                $line['product']->decrement('stock', $line['quantity']);
            }

            $cart->items()->delete();

            return $order;
        });

        // They completed — this session is no longer abandoned, so drop its
        // saved record. Keyed by the cart token the checkout page sent.
        if ($token = (string) $request->header('X-Cart-Token')) {
            AbandonedCheckout::where('cart_token', $token)->delete();
        }

        // Save the shipping address to a signed-in customer's address book so
        // their next checkout is prefilled. Best effort: the order is already
        // placed, and a failure here must not turn into an error for them.
        try {
            \App\Models\Address::rememberFromOrder($order);
        } catch (Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Could not save order address', [
                'order' => $order->order_number,
                'error' => $e->getMessage(),
            ]);
        }

        // Confirmation to the customer plus a copy to the shop — sent once the
        // shopper has their answer (each email takes seconds over Gmail), and
        // a mail outage never fails an order that is already in the database.
        $order->loadMissing('items');
        \App\Support\MailLater::send($order->email, new \App\Mail\OrderPlaced($order), 'Order confirmation', ['order' => $order->order_number]);

        if ($shopEmail = (string) \App\Models\Setting::get('support_email', '')) {
            \App\Support\MailLater::send($shopEmail, new \App\Mail\OrderPlaced($order, forAdmin: true), 'Shop order copy', ['order' => $order->order_number]);
        }

        $requiresPayment = $data['payment_method'] === 'razorpay' && \App\Services\Razorpay::enabled();

        // WhatsApp confirmation through AiGrowBot, when connected (admin →
        // WhatsApp). Sent after the response; a failure is only logged. An
        // online order is confirmed once its payment goes through instead
        // (Razorpay::markPaid), so a shopper who gives up at the payment step
        // is not told their order is on its way.
        if (! $requiresPayment) {
            \App\Services\AiGrowBot::notify('order.placed', \App\Services\AiGrowBot::orderData($order));
        }

        $payload = $order->fresh('items.product.category')->toDetail();
        $payload['requires_payment'] = $requiresPayment;

        return response()->json(['data' => $payload], 201);
    }

    /**
     * Quietly save what a shopper has typed on the checkout page so the shop
     * can follow up if they leave without ordering. The checkout page pings
     * this as they type; the record is wiped the moment they place the order.
     */
    public function abandon(Request $request)
    {
        $data = $request->validate([
            'email' => ['nullable', 'email', 'max:190'],
            'ship_name' => ['nullable', 'string', 'max:120'],
            'ship_phone' => ['nullable', 'string', 'max:30'],
            'ship_address1' => ['nullable', 'string', 'max:190'],
            'ship_city' => ['nullable', 'string', 'max:120'],
            'ship_state' => ['nullable', 'string', 'max:120'],
            'ship_zip' => ['nullable', 'string', 'max:20'],
        ]);

        // No way to reach them yet — don't store an anonymous, useless row.
        $phoneDigits = preg_replace('/\D/', '', (string) ($data['ship_phone'] ?? ''));
        if (empty($data['email']) && strlen($phoneDigits) < 10) {
            return response()->json(['ok' => false]);
        }

        // The cart token is how we dedupe one session to one row.
        $token = (string) $request->header('X-Cart-Token');
        if (! Str::isUuid($token)) {
            return response()->json(['ok' => false]);
        }

        $user = $request->user('sanctum');
        // The shop's own admins poking around checkout aren't sales leads —
        // don't let their visits clutter the abandoned list.
        if ($user && $user->is_admin) {
            return response()->json(['ok' => false]);
        }

        [$snapshot, $subtotal] = $this->snapshotCart($this->findCart($request, $user));

        AbandonedCheckout::updateOrCreate(
            ['cart_token' => $token],
            array_merge($data, [
                'user_id' => $user?->id,
                'cart_snapshot' => $snapshot,
                'subtotal' => $subtotal,
            ])
        );

        return response()->json(['ok' => true]);
    }

    /** A light copy of the cart for the admin to see — names, quantities, price. */
    private function snapshotCart(?Cart $cart): array
    {
        if (! $cart) {
            return [null, 0.0];
        }

        $cart->load('items.product');
        $items = [];
        $subtotal = 0.0;

        foreach ($cart->items as $item) {
            $price = (float) ($item->product->price ?? 0);
            $subtotal += $price * $item->quantity;
            $items[] = [
                'name' => $item->product->name ?? 'Item',
                'quantity' => $item->quantity,
                'price' => $price,
            ];
        }

        return [
            ['items' => $items, 'count' => array_sum(array_column($items, 'quantity'))],
            round($subtotal, 2),
        ];
    }

    private function findCart(Request $request, $user): ?Cart
    {
        if ($user) {
            $cart = Cart::where('user_id', $user->id)->first();
            if ($cart && $cart->items()->count() > 0) {
                return $cart;
            }
        }

        $token = (string) $request->header('X-Cart-Token');

        if ($token && Str::isUuid($token)) {
            return Cart::where('token', $token)->first();
        }

        return null;
    }

    private function generateOrderNumber(): string
    {
        do {
            $number = 'LBI-'.now()->format('Ymd').'-'.strtoupper(Str::random(4));
        } while (Order::where('order_number', $number)->exists());

        return $number;
    }
}
