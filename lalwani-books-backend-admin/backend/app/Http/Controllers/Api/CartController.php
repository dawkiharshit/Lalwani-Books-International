<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cart;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CartController extends Controller
{
    public function show(Request $request)
    {
        $cart = $this->resolveCart($request);

        return response()->json(['data' => $this->payload($cart)]);
    }

    public function addItem(Request $request)
    {
        $data = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'quantity' => ['nullable', 'integer', 'min:1', 'max:20'],
        ]);

        $product = Product::active()->findOrFail($data['product_id']);
        $quantity = $data['quantity'] ?? 1;

        if ($product->stock < 1) {
            return response()->json(['message' => 'This product is out of stock.'], 422);
        }

        $cart = $this->resolveCart($request, true);

        $item = $cart->items()->firstOrNew(['product_id' => $product->id]);
        $item->quantity = min(($item->exists ? $item->quantity : 0) + $quantity, $product->stock, 20);
        $item->save();

        return response()->json(['data' => $this->payload($cart->fresh())], 201);
    }

    public function updateItem(Request $request, int $itemId)
    {
        $data = $request->validate([
            'quantity' => ['required', 'integer', 'min:0', 'max:20'],
        ]);

        $cart = $this->resolveCart($request, true);
        $item = $cart->items()->with('product')->findOrFail($itemId);

        if ($data['quantity'] === 0) {
            $item->delete();
        } else {
            $item->update(['quantity' => min($data['quantity'], $item->product->stock)]);
        }

        return response()->json(['data' => $this->payload($cart->fresh())]);
    }

    public function removeItem(Request $request, int $itemId)
    {
        $cart = $this->resolveCart($request, true);
        $cart->items()->where('id', $itemId)->delete();

        return response()->json(['data' => $this->payload($cart->fresh())]);
    }

    public function clear(Request $request)
    {
        $cart = $this->resolveCart($request, true);
        $cart->items()->delete();

        return response()->json(['data' => $this->payload($cart->fresh())]);
    }

    public function merge(Request $request)
    {
        $user = $request->user();
        $token = (string) $request->header('X-Cart-Token');

        $userCart = Cart::firstOrCreate(['user_id' => $user->id], ['token' => (string) Str::uuid()]);

        if ($token) {
            $guestCart = Cart::where('token', $token)->whereNull('user_id')->first();

            if ($guestCart && $guestCart->id !== $userCart->id) {
                foreach ($guestCart->items as $guestItem) {
                    $item = $userCart->items()->firstOrNew(['product_id' => $guestItem->product_id]);
                    $item->quantity = min(($item->exists ? $item->quantity : 0) + $guestItem->quantity, 20);
                    $item->save();
                }
                $guestCart->delete();
            }
        }

        return response()->json(['data' => $this->payload($userCart->fresh())]);
    }

    private function resolveCart(Request $request, bool $create = false): Cart
    {
        $user = $request->user('sanctum');

        if ($user) {
            return Cart::firstOrCreate(['user_id' => $user->id], ['token' => (string) Str::uuid()]);
        }

        $token = (string) $request->header('X-Cart-Token');

        if ($token && Str::isUuid($token)) {
            $cart = Cart::where('token', $token)->first();
            if ($cart) {
                return $cart;
            }

            return Cart::create(['token' => $token]);
        }

        return Cart::create(['token' => (string) Str::uuid()]);
    }

    private function payload(Cart $cart): array
    {
        $cart->load(['items.product.category']);

        $items = $cart->items->filter(fn ($i) => $i->product && $i->product->is_active)->map(function ($item) {
            return [
                'id' => $item->id,
                'quantity' => $item->quantity,
                'unit_price' => $item->product->price,
                'line_total' => round($item->product->price * $item->quantity, 2),
                'product' => $item->product->toCard(),
            ];
        })->values();

        $subtotal = round($items->sum('line_total'), 2);

        return [
            'token' => $cart->token,
            'items' => $items,
            'items_count' => (int) $items->sum('quantity'),
            'subtotal' => $subtotal,
        ];
    }
}
