<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Review;
use Illuminate\Http\Request;

class AdminReviewController extends Controller
{
    public function index(Request $request)
    {
        $page = Review::with('product:id,name,slug')
            ->when($request->filter === 'hidden', fn ($q) => $q->where('is_approved', false))
            ->when($request->filter === 'visible', fn ($q) => $q->where('is_approved', true))
            ->when($request->search, fn ($q, $s) => $q->where(fn ($w) => $w
                ->where('name', 'like', "%{$s}%")
                ->orWhere('body', 'like', "%{$s}%")))
            ->latest()
            ->paginate(20);

        return response()->json([
            'data' => $page->map(fn (Review $r) => [
                'id' => $r->id,
                'name' => $r->name,
                'rating' => $r->rating,
                'title' => $r->title,
                'body' => $r->body,
                'is_approved' => $r->is_approved,
                'created_at' => $r->created_at?->toIso8601String(),
                'product' => $r->product ? [
                    'id' => $r->product->id,
                    'name' => $r->product->name,
                    'slug' => $r->product->slug,
                ] : null,
            ])->values(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    public function update(Request $request, Review $review)
    {
        $data = $request->validate(['is_approved' => ['required', 'boolean']]);

        $review->update($data);
        $review->product->recalculateRating();

        return response()->json(['data' => ['id' => $review->id, 'is_approved' => $review->is_approved]]);
    }

    public function destroy(Review $review)
    {
        $product = $review->product;
        $review->delete();
        $product->recalculateRating();

        return response()->json(['message' => 'Review deleted.']);
    }
}
