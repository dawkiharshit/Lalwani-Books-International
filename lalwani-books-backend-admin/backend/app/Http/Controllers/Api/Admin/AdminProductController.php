<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Author;
use App\Models\Publisher;
use App\Models\Product;
use App\Support\GiftIdeas;
use App\Support\YouTube;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AdminProductController extends Controller
{
    /** The shop reads dates in India time; the database stores them in UTC. */
    private const TZ = 'Asia/Kolkata';

    public function index(Request $request)
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            // The day a book was listed, as the admin panel's date boxes send it.
            'listed_from' => ['nullable', 'date_format:Y-m-d'],
            'listed_to' => ['nullable', 'date_format:Y-m-d'],
            'sort' => ['nullable', 'in:name,newest,oldest'],
        ]);

        $query = Product::with(['category', 'images']);

        if ($search = trim((string) ($filters['search'] ?? ''))) {
            // Stock codes are how the admin looks a product up off an invoice,
            // so the search box has to match them as well as the name.
            $query->where(fn ($q) => $q
                ->where('name', 'like', "%{$search}%")
                ->orWhere('author', 'like', "%{$search}%")
                ->orWhere('isbn', 'like', "%{$search}%")
                ->orWhere('sku', 'like', "%{$search}%"));
        }

        // "Listed between these two days", inclusive of both. Dates the wrong
        // way round are read as the range the admin meant, not as nothing.
        $from = $filters['listed_from'] ?? null;
        $to = $filters['listed_to'] ?? null;
        if ($from && $to && $from > $to) {
            [$from, $to] = [$to, $from];
        }
        if ($from) {
            $query->where('created_at', '>=', self::dayOpens($from));
        }
        if ($to) {
            $query->where('created_at', '<=', self::dayCloses($to));
        }

        match ($filters['sort'] ?? 'name') {
            // id breaks the tie, so books listed in the same second keep a
            // steady order instead of shuffling between pages.
            'newest' => $query->orderByDesc('created_at')->orderByDesc('id'),
            'oldest' => $query->orderBy('created_at')->orderBy('id'),
            default => $query->orderBy('name'),
        };

        $page = $query->paginate(20);
        $giftIds = GiftIdeas::ids();

        return response()->json([
            'data' => collect($page->items())->map(fn (Product $p) => array_merge($p->toDetail(), [
                'is_active' => $p->is_active,
                // The real FK — the admin UI must never re-derive this from
                // the category name, which breaks as soon as one is renamed.
                'category_id' => $p->category_id,
                'is_gift_idea' => in_array($p->id, $giftIds, true),
                'created_at' => $p->created_at->toIso8601String(),
            ]))->values(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    /**
     * The first and last moment of a day in the shop's own time, as UTC — what
     * the database holds. Without this, a book listed before 5:30am in India
     * counts as the day before, because that is the date in UTC.
     */
    private static function dayOpens(string $date): CarbonImmutable
    {
        return CarbonImmutable::createFromFormat('Y-m-d', $date, self::TZ)->startOfDay()->utc();
    }

    private static function dayCloses(string $date): CarbonImmutable
    {
        return CarbonImmutable::createFromFormat('Y-m-d', $date, self::TZ)->endOfDay()->utc();
    }

    /** Single product for the admin edit form — no scanning a paginated list. */
    public function show(Product $product)
    {
        return response()->json([
            'data' => array_merge($product->load(['category', 'images'])->toDetail(), [
                'is_active' => $product->is_active,
                'category_id' => $product->category_id,
                'is_gift_idea' => GiftIdeas::has($product->id),
                'created_at' => $product->created_at->toIso8601String(),
            ]),
        ]);
    }

    public function store(Request $request)
    {
        $data = $this->validateProduct($request);
        $gift = $this->pullGiftIdea($data);
        // A blank slug is derived from the name, so the unique rule above never
        // saw it — check the derived value before the DB constraint does.
        $data['slug'] = ($data['slug'] ?? '') ?: $this->uniqueSlug($data['name']);
        $data['sku'] = ($data['sku'] ?? '') ?: 'LBI-'.strtoupper(Str::random(6));

        $data = $this->linkAuthor($data, $request);
        $data = $this->linkPublisher($data, $request);

        $product = Product::create($data);
        if ($gift !== null) {
            GiftIdeas::mark($product->id, $gift);
        }

        return response()->json(['data' => $product->fresh('category')->toDetail()], 201);
    }

    public function update(Request $request, Product $product)
    {
        $data = $this->validateProduct($request, $product->id);
        $gift = $this->pullGiftIdea($data);

        // Blanking the SKU field means "leave it alone", never "wipe it" —
        // stock codes are referenced outside this app.
        if (empty($data['sku'])) {
            unset($data['sku']);
        }

        // The photo is managed only by its own upload/remove endpoints and is
        // never taken from the form. The edit form used to echo the path it
        // had loaded, so saving it right after uploading a new photo wrote
        // that stale path back — pointing the book at a file the upload had
        // just deleted — and a blank wiped the photo altogether.
        unset($data['image']);

        $data = $this->linkAuthor($data, $request);
        $data = $this->linkPublisher($data, $request);

        $product->update($data);
        if ($gift !== null) {
            GiftIdeas::mark($product->id, $gift);
        }

        return response()->json(['data' => $product->fresh('category')->toDetail()]);
    }

    /**
     * "Gift idea" is not a column but a place on the Gift Ideas list (see
     * GiftIdeas), so it comes out of the book's fields here. Null when the
     * form did not send it: the book's place on the list is then left alone.
     */
    private function pullGiftIdea(array &$data): ?bool
    {
        if (! array_key_exists('is_gift_idea', $data)) {
            return null;
        }
        $gift = (bool) $data['is_gift_idea'];
        unset($data['is_gift_idea']);

        return $gift;
    }

    public function destroy(Product $product)
    {
        $product->update(['is_active' => false]);

        return response()->json(['message' => 'Product archived.']);
    }

    /**
     * Tie the book to an author record (admin → Categories & Authors) and keep
     * the `author` text — what every card prints — in step with it.
     *
     * The admin form sends `author_id` (null for none). An API client may
     * still send a typed `author` name instead; that is filed under a record
     * of the same name, created when there is none, so the author shows up
     * on the storefront's author lists like any other.
     */
    private function linkAuthor(array $data, Request $request): array
    {
        if ($request->has('author_id')) {
            $author = ! empty($data['author_id']) ? Author::find($data['author_id']) : null;
            $data['author_id'] = $author?->id;
            $data['author'] = $author?->name;

            return $data;
        }

        if (array_key_exists('author', $data)) {
            $name = trim((string) $data['author']);
            if ($name === '') {
                $data['author'] = null;
                $data['author_id'] = null;

                return $data;
            }
            $slug = Str::slug($name) ?: 'author-'.substr(md5($name), 0, 8);
            $author = Author::firstOrCreate(
                ['slug' => $slug],
                ['name' => $name, 'sort_order' => (int) Author::max('sort_order') + 1],
            );
            $data['author_id'] = $author->id;
            $data['author'] = $author->name;
        }

        return $data;
    }

    /**
     * Tie the book to a publisher record (admin → Publishers) and keep the
     * `publisher` text — what the book page prints — in step with it, the
     * same way linkAuthor() does for authors: the admin form sends
     * `publisher_id`; a typed `publisher` name is filed under a record of
     * that name, created when there is none.
     */
    private function linkPublisher(array $data, Request $request): array
    {
        if ($request->has('publisher_id')) {
            $publisher = ! empty($data['publisher_id']) ? Publisher::find($data['publisher_id']) : null;
            $data['publisher_id'] = $publisher?->id;
            $data['publisher'] = $publisher?->name;

            return $data;
        }

        if (array_key_exists('publisher', $data)) {
            $name = trim((string) $data['publisher']);
            if ($name === '') {
                $data['publisher'] = null;
                $data['publisher_id'] = null;

                return $data;
            }
            $slug = Str::slug($name) ?: 'publisher-'.substr(md5($name), 0, 8);
            $publisher = Publisher::firstOrCreate(
                ['slug' => $slug],
                ['name' => $name, 'sort_order' => (int) Publisher::max('sort_order') + 1],
            );
            $data['publisher_id'] = $publisher->id;
            $data['publisher'] = $publisher->name;
        }

        return $data;
    }

    /** Derive a slug from the name, refusing rather than colliding. */
    private function uniqueSlug(string $name): string
    {
        $slug = Str::slug($name);

        if ($slug === '') {
            throw ValidationException::withMessages([
                'name' => 'Use a name with at least one letter or number.',
            ]);
        }

        if (Product::where('slug', $slug)->exists()) {
            throw ValidationException::withMessages([
                'name' => 'A product with this name already exists.',
            ]);
        }

        return $slug;
    }

    private function validateProduct(Request $request, ?int $ignoreId = null): array
    {
        $data = $request->validate([
            'category_id' => ['required', 'integer', 'exists:categories,id'],
            'name' => ['required', 'string', 'max:190'],
            'author' => ['nullable', 'string', 'max:190'],
            'author_id' => ['nullable', 'integer', 'exists:authors,id'],
            'publisher' => ['nullable', 'string', 'max:190'],
            'publisher_id' => ['nullable', 'integer', 'exists:publishers,id'],
            'isbn' => ['nullable', 'string', 'max:20', 'regex:/^[0-9Xx-]{10,17}$/'],
            'pages' => ['nullable', 'integer', 'min:1', 'max:65000'],
            'language' => ['nullable', 'string', 'max:60'],
            'binding' => ['nullable', 'string', 'max:40'],
            'published_year' => ['nullable', 'integer', 'min:1000', 'max:2100'],
            'slug' => ['nullable', 'string', 'max:190', 'unique:products,slug'.($ignoreId ? ','.$ignoreId : '')],
            'sku' => ['nullable', 'string', 'max:40', 'unique:products,sku'.($ignoreId ? ','.$ignoreId : '')],
            // Indian HSN codes are 4, 6 or 8 digits.
            'hsn_code' => ['nullable', 'string', 'regex:/^\d{4}(\d{2}(\d{2})?)?$/'],
            'weight_grams' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'low_stock_threshold' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'tagline' => ['nullable', 'string', 'max:190'],
            'description' => ['required', 'string'],
            'price' => ['required', 'numeric', 'min:0'],
            'compare_at_price' => ['nullable', 'numeric', 'min:0'],
            'stock' => ['required', 'integer', 'min:0'],
            'size_ml' => ['nullable', 'integer', 'min:1'],
            'is_featured' => ['boolean'],
            'is_new_arrival' => ['boolean'],
            'is_category_pick' => ['boolean'],
            'is_bestseller' => ['boolean'],
            'is_gift_idea' => ['sometimes', 'boolean'],
            'is_active' => ['boolean'],
            'image' => ['nullable', 'string', 'max:255'],
            // A YouTube video link, in any of its shapes; anything else would
            // save fine and then never play, so it is refused with a reason.
            // The uploaded .mp4 is handled separately via the media endpoints.
            'video_url' => ['nullable', 'url', 'max:255', function (string $attribute, mixed $value, \Closure $fail) {
                if ($value && ! YouTube::id((string) $value)) {
                    $fail('Paste a YouTube video link, like https://www.youtube.com/watch?v=… or https://youtu.be/… — or upload an .mp4 below the photos.');
                }
            }],
            'color_from' => ['required', 'string', 'max:10'],
            'color_to' => ['required', 'string', 'max:10'],
            'accent' => ['required', 'string', 'max:10'],
            'notes_top' => ['nullable', 'string', 'max:190'],
            'notes_heart' => ['nullable', 'string', 'max:190'],
            'notes_base' => ['nullable', 'string', 'max:190'],
        ]);

        return $data;
    }
}
