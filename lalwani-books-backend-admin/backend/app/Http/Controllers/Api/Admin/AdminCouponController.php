<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use Illuminate\Http\Request;

class AdminCouponController extends Controller
{
    public function index()
    {
        return response()->json(['data' => Coupon::orderBy('code')->get()]);
    }

    public function store(Request $request)
    {
        $data = $this->validateCoupon($request);
        $data['code'] = strtoupper($data['code']);

        $coupon = Coupon::create($data);

        return response()->json(['data' => $coupon], 201);
    }

    public function update(Request $request, Coupon $coupon)
    {
        $data = $this->validateCoupon($request, $coupon->id);
        $data['code'] = strtoupper($data['code']);

        $coupon->update($data);

        return response()->json(['data' => $coupon->fresh()]);
    }

    public function destroy(Coupon $coupon)
    {
        $coupon->delete();

        return response()->json(['message' => 'Coupon deleted.']);
    }

    private function validateCoupon(Request $request, ?int $ignoreId = null): array
    {
        return $request->validate([
            'code' => ['required', 'string', 'max:40', 'unique:coupons,code'.($ignoreId ? ','.$ignoreId : '')],
            'type' => ['required', 'in:percent,fixed'],
            'value' => ['required', 'numeric', 'min:0.01'],
            'min_order' => ['nullable', 'numeric', 'min:0'],
            'max_uses' => ['nullable', 'integer', 'min:1'],
            'expires_at' => ['nullable', 'date'],
            'is_active' => ['boolean'],
            // Whether shoppers see it advertised on checkout, or must type it.
            'is_public' => ['boolean'],
        ]);
    }
}
