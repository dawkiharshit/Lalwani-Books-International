<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\Request;

class WishlistController extends Controller
{
    public function index(Request $request)
    {
        $items = $request->user()->wishlist()
            ->with('product.category')
            ->orderByDesc('created_at')
            ->get()
            ->filter(fn ($w) => $w->product && $w->product->is_active)
            ->map(fn ($w) => array_merge($w->product->toCard(), [
                'wishlisted_at' => $w->created_at->toIso8601String(),
            ]))
            ->values();

        return response()->json(['data' => $items]);
    }

    public function store(Request $request, int $productId)
    {
        Product::active()->findOrFail($productId);

        $request->user()->wishlist()->firstOrCreate(['product_id' => $productId]);

        return response()->json(['message' => 'Added to wishlist.'], 201);
    }

    public function destroy(Request $request, int $productId)
    {
        $request->user()->wishlist()->where('product_id', $productId)->delete();

        return response()->json(['message' => 'Removed from wishlist.']);
    }
}
