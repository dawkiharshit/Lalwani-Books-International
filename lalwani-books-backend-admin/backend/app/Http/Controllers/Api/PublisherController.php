<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Publisher;

class PublisherController extends Controller
{
    /** How many of a publisher's books stand on their card on the Publications page. */
    private const SHELF = 3;

    /**
     * Every publisher, with how many of their books are live in the shop and a
     * few of those books (bestsellers first) for their card on Publications.
     */
    public function index()
    {
        return response()->json([
            'data' => Publisher::query()
                ->withCount(['products' => fn ($q) => $q->where('is_active', true)])
                // One query for every publisher's few books (a per-publisher limit).
                ->with(['products' => fn ($q) => $q->where('is_active', true)
                    ->select(['id', 'publisher_id', 'name', 'slug', 'author', 'image', 'color_from', 'color_to', 'accent'])
                    ->orderByDesc('is_bestseller')
                    ->orderByDesc('is_featured')
                    ->orderByDesc('id')
                    ->limit(self::SHELF)])
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get()
                ->map(fn (Publisher $publisher) => $publisher->toArray() + [
                    'books' => $publisher->products->map(fn (Product $book) => [
                        'id' => $book->id,
                        'name' => $book->name,
                        'slug' => $book->slug,
                        'author' => $book->author,
                        'image' => Product::imageUrl($book->image),
                        'colors' => [
                            'from' => $book->color_from,
                            'to' => $book->color_to,
                            'accent' => $book->accent,
                        ],
                    ])->values()->all(),
                ])
                ->values(),
        ]);
    }
}
