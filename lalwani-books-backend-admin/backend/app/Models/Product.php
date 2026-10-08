<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    protected $fillable = [
        'category_id', 'name', 'slug', 'tagline',
        'author', 'author_id', 'publisher', 'publisher_id', 'isbn', 'pages', 'language', 'binding', 'published_year',
        'description', 'price', 'compare_at_price', 'stock', 'sku', 'size_ml',
        'hsn_code', 'weight_grams', 'low_stock_threshold',
        'rating_avg', 'rating_count', 'is_featured', 'is_new_arrival', 'is_category_pick', 'is_bestseller', 'is_active',
        'color_from', 'color_to', 'accent', 'image', 'video_url', 'video_path',
        'notes_top', 'notes_heart', 'notes_base',
    ];

    /** Used when a product carries no threshold of its own. */
    public const DEFAULT_LOW_STOCK = 10;

    /**
     * Fallback shipping weight when nobody has entered one, in grams.
     * Sized for an average paperback in its packing — set an exact per-product
     * weight in the product editor when it differs.
     */
    public const DEFAULT_WEIGHT_GRAMS = 400;

    protected $casts = [
        'price' => 'float',
        'compare_at_price' => 'float',
        'weight_grams' => 'integer',
        'low_stock_threshold' => 'integer',
        'rating_avg' => 'float',
        'is_featured' => 'boolean',
        'is_new_arrival' => 'boolean',
        'is_category_pick' => 'boolean',
        'is_bestseller' => 'boolean',
        'is_active' => 'boolean',
        'pages' => 'integer',
        'published_year' => 'integer',
    ];

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function images()
    {
        return $this->hasMany(ProductImage::class)->orderBy('sort');
    }

    /**
     * The author record (admin → Categories & Authors). Named so it cannot be
     * confused with the `author` column, the display copy of the name.
     */
    public function authorRecord()
    {
        return $this->belongsTo(Author::class, 'author_id');
    }

    /**
     * The publisher record (admin → Publishers). Named so it cannot be
     * confused with the `publisher` column, the display copy of the name.
     */
    public function publisherRecord()
    {
        return $this->belongsTo(Publisher::class, 'publisher_id');
    }

    public function reviews()
    {
        return $this->hasMany(Review::class);
    }

    public function approvedReviews()
    {
        return $this->hasMany(Review::class)->where('is_approved', true);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function recalculateRating(): void
    {
        $agg = $this->approvedReviews()
            ->selectRaw('COUNT(*) as cnt, COALESCE(AVG(rating), 0) as avg_rating')
            ->first();

        $this->forceFill([
            'rating_count' => (int) $agg->cnt,
            'rating_avg' => round((float) $agg->avg_rating, 2),
        ])->save();
    }


    /** Public URL for an image reference: storage uploads get the backend origin. */
    public static function imageUrl(?string $path): ?string
    {
        if (!$path) {
            return null;
        }
        if (str_starts_with($path, "storage/")) {
            // Root-relative: the Next.js frontend proxies /storage/* to this
            // backend, so uploads stay same-origin for every page that shows them.
            return "/".$path;
        }

        return $path;
    }

    public function toCard(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'tagline' => $this->tagline,
            // Shown under the title on every book card.
            'author' => $this->author,
            'author_id' => $this->author_id,
            'publisher_id' => $this->publisher_id,
            'price' => $this->price,
            'compare_at_price' => $this->compare_at_price,
            'rating_avg' => $this->rating_avg,
            'rating_count' => $this->rating_count,
            'is_bestseller' => $this->is_bestseller,
            'image' => self::imageUrl($this->image),
            'is_featured' => $this->is_featured,
            'is_new_arrival' => (bool) $this->is_new_arrival,
            'is_category_pick' => (bool) $this->is_category_pick,
            'in_stock' => $this->stock > 0,
            // Already printed on the product page — and it is what an admin
            // reads off the shelf when packing an order.
            'sku' => $this->sku,
            'size_ml' => $this->size_ml,
            'colors' => [
                'from' => $this->color_from,
                'to' => $this->color_to,
                'accent' => $this->accent,
            ],
            'category' => $this->category ? [
                'name' => $this->category->name,
                'slug' => $this->category->slug,
            ] : null,
        ];
    }

    /** The product video, resolved for the storefront: a YouTube link, an
     *  uploaded file, or nothing. */
    public function videoPayload(): ?array
    {
        if ($this->video_url) {
            return ['type' => 'youtube', 'url' => $this->video_url];
        }
        if ($this->video_path) {
            return ['type' => 'file', 'url' => self::imageUrl($this->video_path)];
        }

        return null;
    }

    public function toDetail(): array
    {
        return array_merge($this->toCard(), [
            'sku' => $this->sku,
            'hsn_code' => $this->hsn_code,
            // Raw link for the admin form; resolved payload for the storefront.
            'video_url' => $this->video_url,
            'video' => $this->videoPayload(),
            'description' => $this->description,
            'book' => [
                'author' => $this->author,
                'publisher' => $this->publisher,
                'isbn' => $this->isbn,
                'pages' => $this->pages,
                'language' => $this->language,
                'binding' => $this->binding,
                'published_year' => $this->published_year,
            ],
            'stock' => $this->stock,
            'weight_grams' => $this->weight_grams,
            'low_stock_threshold' => $this->low_stock_threshold,
            'gallery' => $this->images->sortBy('sort')->map(fn ($i) => [
                'id' => $i->id,
                'url' => self::imageUrl($i->path),
                'alt' => $i->alt,
            ])->values()->all(),
            'notes' => [
                'top' => $this->notes_top,
                'heart' => $this->notes_heart,
                'base' => $this->notes_base,
            ],
        ]);
    }
}
