<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Author;
use App\Models\Category;
use App\Models\Product;
use App\Support\Isbn;
use App\Support\SearchLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * Suggestions while a shopper types in a search box: matching books, authors,
 * categories (subjects) and, when the text looks like one, ISBNs — a handful
 * of each, best matches first. Four small indexed-table queries, cached by
 * the browser for a minute so retyping costs nothing.
 */
class SearchController extends Controller
{
    private const MIN = 2;

    public function suggest(Request $request)
    {
        $q = trim(mb_substr((string) $request->query('q', ''), 0, 80));
        $empty = ['query' => $q, 'books' => [], 'authors' => [], 'categories' => [], 'isbn' => []];

        if (mb_strlen($q) < self::MIN) {
            return $this->json($empty);
        }

        // Typed % and _ are letters here, not LIKE wildcards.
        $text = addcslashes($q, '%_\\');
        $contains = "%{$text}%";
        $prefix = "{$text}%";
        $digits = Isbn::digits($q);
        $looksLikeIsbn = strlen($digits) >= 4 && strlen($digits) >= mb_strlen(preg_replace('/[\s-]/', '', $q)) - 1;

        $books = Product::active()
            ->with('category')
            ->where(fn ($w) => $w
                ->where('name', 'like', $contains)
                ->orWhere('author', 'like', $contains)
                ->orWhere('publisher', 'like', $contains)
                ->orWhereHas('category', fn ($c) => $c->where('name', 'like', $contains)))
            ->orderByRaw(
                'CASE WHEN name LIKE ? THEN 0 WHEN name LIKE ? THEN 1 WHEN author LIKE ? THEN 2 ELSE 3 END',
                [$prefix, $contains, $contains]
            )
            ->orderByDesc('rating_avg')
            ->limit(6)
            ->get()
            ->map(fn (Product $p) => $p->toCard())
            ->values();

        $authors = Author::query()
            ->where('name', 'like', $contains)
            ->withCount(['products' => fn ($w) => $w->where('is_active', true)])
            ->having('products_count', '>', 0)
            ->orderByRaw('CASE WHEN name LIKE ? THEN 0 ELSE 1 END', [$prefix])
            ->orderBy('name')
            ->limit(4)
            ->get()
            ->map(fn (Author $a) => [
                'name' => $a->name,
                'slug' => $a->slug,
                'photo' => Product::imageUrl($a->photo),
                'books' => (int) $a->products_count,
            ])
            ->values();

        $categories = Category::query()
            ->where('name', 'like', $contains)
            ->withCount(['products' => fn ($w) => $w->where('is_active', true)])
            ->orderByRaw('CASE WHEN name LIKE ? THEN 0 ELSE 1 END', [$prefix])
            ->orderBy('sort_order')
            ->limit(4)
            ->get()
            ->map(fn (Category $c) => ['name' => $c->name, 'slug' => $c->slug, 'books' => (int) $c->products_count])
            ->values();

        $isbn = $looksLikeIsbn
            ? Product::active()
                ->whereNotNull('isbn')
                // Either form of a full ISBN finds the book (see Isbn::variants).
                ->where(function ($w) use ($digits) {
                    foreach (Isbn::variants($digits) as $isbn) {
                        $w->orWhereRaw("REPLACE(REPLACE(isbn, '-', ''), ' ', '') LIKE ?", ['%'.$isbn.'%']);
                    }
                })
                ->limit(3)
                ->get(['id', 'name', 'slug', 'author', 'isbn', 'image'])
                ->map(fn (Product $p) => ['isbn' => $p->isbn, 'name' => $p->name, 'slug' => $p->slug, 'author' => $p->author])
                ->values()
            : [];

        return $this->json(['query' => $q, 'books' => $books, 'authors' => $authors, 'categories' => $categories, 'isbn' => $isbn]);
    }

    /**
     * A finished search, for admin → Search insights (see SearchLog): the
     * words, how it ended (results / pick / typed) and, for a book opened from
     * it, the book. Always answered with nothing, so it tells a caller
     * nothing. The same search ending the same way counts once per shopper
     * in ten minutes, so reloading a page — or a script — cannot inflate it.
     */
    public function record(Request $request)
    {
        $text = $request->input('q');
        $way = $request->input('via');
        $book = $request->input('book');
        $term = SearchLog::normalize(is_string($text) ? $text : '');

        if (is_string($way) && in_array($way, SearchLog::WAYS, true) && SearchLog::keepable($term)) {
            $bookId = is_string($book) && $book !== ''
                ? Product::active()->where('slug', mb_substr($book, 0, 200))->value('id')
                : null;
            $once = 'search-noted:'.sha1($request->ip().'|'.$way.'|'.$term.'|'.$bookId);
            if (($way !== 'open' || $bookId) && Cache::add($once, true, 600)) {
                SearchLog::record($term, $way, $bookId ? (int) $bookId : null);
            }
        }

        return response()->noContent();
    }

    private function json(array $data)
    {
        return response()->json(['data' => $data])->header('Cache-Control', 'public, max-age=60');
    }
}
