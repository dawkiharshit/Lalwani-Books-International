<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\Request;

class ReviewController extends Controller
{
    public function index(Request $request, string $slug)
    {
        $product = Product::active()->where('slug', $slug)->firstOrFail();

        $reviews = $product->approvedReviews()
            ->orderByDesc('created_at')
            ->paginate(6);

        return response()->json([
            'data' => collect($reviews->items())->map(fn ($r) => [
                'id' => $r->id,
                'name' => $r->name,
                'rating' => $r->rating,
                'title' => $r->title,
                'body' => $r->body,
                'created_at' => $r->created_at->toIso8601String(),
            ])->values(),
            'meta' => [
                'current_page' => $reviews->currentPage(),
                'last_page' => $reviews->lastPage(),
                'total' => $reviews->total(),
                'rating_avg' => $product->rating_avg,
                'rating_count' => $product->rating_count,
            ],
        ]);
    }

    public function store(Request $request, string $slug)
    {
        $product = Product::active()->where('slug', $slug)->firstOrFail();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'title' => ['nullable', 'string', 'max:190'],
            'body' => ['required', 'string', 'max:2000'],
        ]);

        $user = $request->user('sanctum');

        // New reviews wait for admin approval before they appear on the
        // storefront — the admin moderates them under Admin → Reviews. The
        // rating only counts approved reviews, so it does not move yet.
        $review = $product->reviews()->create(array_merge($data, [
            'user_id' => $user ? $user->id : null,
            'is_approved' => false,
        ]));

        return response()->json([
            'message' => 'Thank you! Your review will appear once it is approved.',
            'pending' => true,
            'data' => [
                'id' => $review->id,
                'name' => $review->name,
                'rating' => $review->rating,
                'title' => $review->title,
                'body' => $review->body,
                'created_at' => $review->created_at->toIso8601String(),
            ],
        ], 201);
    }
}
