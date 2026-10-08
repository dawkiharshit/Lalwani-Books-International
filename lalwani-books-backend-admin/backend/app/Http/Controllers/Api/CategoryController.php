<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;

class CategoryController extends Controller
{
    public function index()
    {
        $categories = Category::query()
            ->withCount(['products' => fn ($q) => $q->where('is_active', true)])
            // A representative photo per collection: prefer a featured product,
            // otherwise the highest-rated one that actually has an image.
            ->with(['products' => fn ($q) => $q
                ->where('is_active', true)
                ->whereNotNull('image')
                ->orderByDesc('is_featured')
                ->orderByDesc('rating_avg')
                ->limit(1),
            ])
            ->orderBy('sort_order')
            ->get()
            ->map(fn (Category $c) => [
                'id' => $c->id,
                'name' => $c->name,
                'slug' => $c->slug,
                'tagline' => $c->tagline,
                'description' => $c->description,
                'products_count' => $c->products_count,
                // The collection's own artwork wins; otherwise borrow a product photo.
                'image' => \App\Models\Product::imageUrl($c->image ?: $c->products->first()?->image),
            ]);

        return response()->json(['data' => $categories]);
    }
}
