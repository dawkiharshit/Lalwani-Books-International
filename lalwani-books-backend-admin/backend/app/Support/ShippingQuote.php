<?php

namespace App\Support;

use App\Models\Cart;
use App\Models\Product;
use App\Models\Setting;
use App\Services\Shiprocket;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * What a customer is charged to ship a cart.
 *
 * The one place this is decided, so the figure quoted at checkout and the
 * figure written onto the order are always the same number. Quoting one price
 * and charging another is the failure this class exists to prevent.
 *
 * Order of decision:
 *   1. Cart is over the free-shipping threshold  -> free
 *   2. Shiprocket is configured and answers      -> its live rate
 *   3. Anything else                             -> the flat rate
 */
class ShippingQuote
{
    /** Shiprocket's answer for a PIN barely moves, so don't re-ask per keystroke. */
    private const CACHE_MINUTES = 30;

    /**
     * @return array{charge: float, source: string, courier: ?string, days: ?int, serviceable: bool}
     */
    public static function for(float $shippableBase, float $weightKg, ?string $pin, bool $cod): array
    {
        // The same fallbacks the storefront quotes from (the Shipping & Tax
        // defaults). A hard-coded 0 here shipped every order free — while the
        // cart page promised ₹149 — whenever the setting had no row yet.
        $freeOver = (float) Setting::get('free_shipping_threshold', \App\Http\Controllers\Api\CheckoutController::FREE_SHIPPING_THRESHOLD);
        $flat = (float) Setting::get('flat_shipping', \App\Http\Controllers\Api\CheckoutController::FLAT_SHIPPING);

        // A shop-wide promise outranks whatever the courier costs.
        if ($freeOver > 0 && $shippableBase >= $freeOver) {
            return self::result(0.0, 'free_over_threshold', null, null, true);
        }

        if ($pin && preg_match('/^\d{6}$/', $pin) && Shiprocket::enabled()) {
            $live = self::live($pin, $weightKg, $cod);

            if ($live) {
                // The serviceability API quotes bare freight. Shiprocket's panel
                // then adds a flat per-shipment charge (the "Secure Shipment"
                // insurance, ~₹54) that the API never reports — so the seller
                // pays more than this rate unless we cover it. The buffer (flat
                // by default) closes that gap.
                if ($live['serviceable']) {
                    $live['charge'] = self::withBuffer($live['charge'], $shippableBase);
                }

                return $live;
            }
        }

        return self::result($flat, 'flat_rate', null, null, true);
    }

    /**
     * Add the shop's shipping buffer to a live courier rate: a percentage of
     * order value (covers the value-scaled insurance) plus an optional flat
     * amount (any fixed handling). Both are admin-settable; zero them to charge
     * the bare courier rate.
     */
    private static function withBuffer(float $rate, float $base): float
    {
        $pct = (float) Setting::get('shipping_buffer_percent', 0);
        $flat = (float) Setting::get('shipping_buffer_flat', 60);

        return round($rate + $flat + $base * $pct / 100, 2);
    }

    /** Weight of everything in a cart, in kilos, packaging included. */
    public static function cartWeightKg(?Cart $cart): float
    {
        if (! $cart) {
            return 0.5;
        }

        $cart->loadMissing('items.product');

        $grams = $cart->items->sum(
            fn ($i) => ($i->product?->weight_grams ?: Product::DEFAULT_WEIGHT_GRAMS) * (int) $i->quantity
        );

        $grams += (int) config('gateways.shiprocket.packaging_grams', 100);

        return max(round($grams / 1000, 3), 0.05);
    }

    /**
     * Ask Shiprocket. Returns null on anything unexpected so the caller falls
     * back to the flat rate — a courier outage must never block a checkout.
     */
    private static function live(string $pin, float $weightKg, bool $cod): ?array
    {
        $key = sprintf('ship_quote:%s:%s:%d', $pin, $weightKg, $cod ? 1 : 0);

        try {
            return Cache::remember($key, now()->addMinutes(self::CACHE_MINUTES), function () use ($pin, $weightKg, $cod) {
                $json = Shiprocket::serviceability($pin, $weightKg, $cod);
                $couriers = $json['data']['available_courier_companies'] ?? [];

                if (! is_array($couriers) || $couriers === []) {
                    // A real answer meaning "nobody delivers there".
                    return self::result(0.0, 'not_serviceable', null, null, false);
                }

                // Cheapest of what is actually offered.
                usort($couriers, fn ($a, $b) => ($a['rate'] ?? PHP_INT_MAX) <=> ($b['rate'] ?? PHP_INT_MAX));
                $best = $couriers[0];

                return self::result(
                    round((float) ($best['rate'] ?? 0), 2),
                    'shiprocket',
                    $best['courier_name'] ?? null,
                    isset($best['estimated_delivery_days']) ? (int) $best['estimated_delivery_days'] : null,
                    true
                );
            });
        } catch (Throwable $e) {
            Log::warning('Shipping quote failed, falling back to the flat rate', [
                'pin' => $pin,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    private static function result(float $charge, string $source, ?string $courier, ?int $days, bool $serviceable): array
    {
        return [
            'charge' => $charge,
            'source' => $source,
            'courier' => $courier,
            'days' => $days,
            'serviceable' => $serviceable,
        ];
    }
}
