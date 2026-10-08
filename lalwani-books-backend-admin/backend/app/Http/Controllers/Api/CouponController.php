<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use Illuminate\Http\Request;

class CouponController extends Controller
{
    /**
     * The offers the shop wants shown on the checkout page. Only the fields a
     * shopper needs to decide go out — never the usage counts or limits.
     */
    public function publicList()
    {
        $coupons = Coupon::advertisable()
            ->orderBy('min_order')
            ->orderBy('code')
            ->get()
            ->map(fn (Coupon $c) => [
                'code' => $c->code,
                'type' => $c->type,
                'value' => $c->value,
                'min_order' => $c->min_order,
                'expires_at' => optional($c->expires_at)->toIso8601String(),
            ]);

        return response()->json(['data' => $coupons]);
    }

    public function validateCode(Request $request)
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:40'],
            'subtotal' => ['required', 'numeric', 'min:0'],
        ]);

        $coupon = Coupon::where('code', strtoupper(trim($data['code'])))->first();

        if (! $coupon) {
            return response()->json(['message' => 'Invalid coupon code.'], 404);
        }

        [$valid, $error] = $coupon->isValidFor((float) $data['subtotal']);

        if (! $valid) {
            return response()->json(['message' => $error], 422);
        }

        return response()->json([
            'data' => [
                'code' => $coupon->code,
                'type' => $coupon->type,
                'value' => $coupon->value,
                'discount' => $coupon->discountFor((float) $data['subtotal']),
            ],
        ]);
    }
}
