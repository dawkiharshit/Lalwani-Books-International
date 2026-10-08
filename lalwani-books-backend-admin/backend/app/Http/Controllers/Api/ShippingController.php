<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cart;
use App\Models\Product;
use App\Support\ShippingQuote;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/** Live shipping cost for the customer's own cart and PIN code. */
class ShippingController extends Controller
{
    public function quote(Request $request)
    {
        $data = $request->validate([
            'pin' => ['required', 'string', 'regex:/^\d{6}$/'],
            'cod' => ['nullable', 'boolean'],
        ]);

        $cart = $this->findCart($request);

        if (! $cart || $cart->items()->count() === 0) {
            return response()->json(['message' => 'Your cart is empty.'], 422);
        }

        $cart->loadMissing('items.product');

        // Prices come from the products, never from anything the browser sent.
        $subtotal = $cart->items->sum(
            fn ($i) => (float) ($i->product?->price ?? 0) * (int) $i->quantity
        );

        $quote = ShippingQuote::for(
            $subtotal,
            ShippingQuote::cartWeightKg($cart),
            $data['pin'],
            (bool) ($data['cod'] ?? false)
        );

        return response()->json(['data' => $quote]);
    }

    /** Same rule as checkout: the signed-in cart, else the guest token. */
    private function findCart(Request $request): ?Cart
    {
        if ($user = $request->user('sanctum')) {
            $cart = Cart::where('user_id', $user->id)->first();
            if ($cart && $cart->items()->count() > 0) {
                return $cart;
            }
        }

        $token = (string) $request->header('X-Cart-Token');

        return $token && Str::isUuid($token) ? Cart::where('token', $token)->first() : null;
    }
}
