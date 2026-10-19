<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Support\GiftIdeas;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $query = Product::query()->active()->with('category');

        // A comma-separated id list — the guest wishlist reads its saved ids
        // from the browser and asks for exactly those products.
        if ($ids = trim((string) $request->query('ids'))) {
            $idList = array_values(array_filter(array_map('intval', explode(',', $ids))));
            $query->whereIn('id', $idList ?: [0]);
        }

        // Title, author, publisher, ISBN or subject (see Product::scopeSearch).
        if ($search = trim(mb_substr((string) $request->query('search'), 0, 120))) {
            $query->search($search);
        }

        // An author's shelf: /collection?author=<slug>.
        if ($author = $request->query('author')) {
            $query->whereHas('authorRecord', fn ($q) => $q->where('slug', $author));
        }

        // A publisher's shelf: /collection?publisher=<slug>.
        if ($publisher = $request->query('publisher')) {
            $query->whereHas('publisherRecord', fn ($q) => $q->where('slug', $publisher));
        }

        // One category, or several separated by commas — the "Books for
        // Schools / Universities / Corporates" shelves are a few categories each.
        if ($category = $request->query('category')) {
            $slugs = array_slice(array_values(array_filter(array_map('trim', explode(',', (string) $category)))), 0, 12);
            $query->whereHas('category', fn ($q) => $q->whereIn('slug', $slugs));
        }

        // Home rail asks for the hand-picked arrivals.
        if ($request->boolean('new_arrival')) {
            $query->where('is_new_arrival', true);
        }

        if ($request->boolean('bestsellers')) {
            $query->where('is_bestseller', true);
        }

        if ($request->boolean('featured')) {
            $query->where('is_featured', true);
        }

        // Gift Ideas: the books ticked "Gift idea" in admin → Products. Until
        // any of those are on sale, hardcovers and bestsellers stand in.
        if ($request->boolean('gift')) {
            $giftIds = GiftIdeas::ids();
            if ($giftIds && Product::query()->active()->whereIn('id', $giftIds)->exists()) {
                $query->whereIn('id', $giftIds);
            } else {
                $query->where(fn ($q) => $q->where('binding', 'like', 'hard%')->orWhere('is_bestseller', true));
            }
        }

        if (is_numeric($request->query('min_price'))) {
            $query->where('price', '>=', (float) $request->query('min_price'));
        }

        if (is_numeric($request->query('max_price'))) {
            $query->where('price', '<=', (float) $request->query('max_price'));
        }

        $sort = $request->query('sort', 'featured');
        match ($sort) {
            'price_asc' => $query->orderBy('price'),
            'price_desc' => $query->orderByDesc('price'),
            'rating' => $query->orderByDesc('rating_avg'),
            'newest' => $query->orderByDesc('created_at'),
            'name' => $query->orderBy('name'),
            default => $query->orderByDesc('is_bestseller')->orderByDesc('rating_avg'),
        };

        $perPage = min(max((int) $request->query('per_page', 12), 1), 48);
        $page = $query->paginate($perPage);

        return response()->json([
            'data' => collect($page->items())->map(fn (Product $p) => $p->toCard())->values(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    public function show(string $slug)
    {
        $product = Product::active()->with(['category', 'images'])->where('slug', $slug)->firstOrFail();

        return response()->json(['data' => $product->toDetail()]);
    }

    public function related(string $slug)
    {
        $product = Product::active()->with('category')->where('slug', $slug)->firstOrFail();

        $related = Product::active()->with('category')
            ->where('id', '!=', $product->id)
            ->where(function ($q) use ($product) {
                $q->where('category_id', $product->category_id)
                    ->orWhere('is_bestseller', true);
            })
            ->orderByDesc('rating_avg')
            ->limit(4)
            ->get();

        return response()->json([
            'data' => $related->map(fn (Product $p) => $p->toCard())->values(),
        ]);
    }
}
