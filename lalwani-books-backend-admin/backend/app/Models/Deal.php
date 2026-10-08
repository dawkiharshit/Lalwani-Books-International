<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/** One offer in the home page's Deals Of The Week slider (admin → Deals). */
class Deal extends Model
{
    /** The panel colourways the storefront knows how to draw. */
    public const THEMES = ['coral', 'pine', 'plum', 'ocean'];

    protected $fillable = [
        'eyebrow', 'heading', 'highlight', 'description', 'ends_label', 'ends_at',
        'button_text', 'button_url', 'category_id', 'theme', 'is_active', 'sort_order',
    ];

    protected $casts = [
        'ends_at' => 'datetime',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
        'category_id' => 'integer',
    ];

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    /** On the storefront: switched on and not past its end date, in slider order. */
    public function scopeLive(Builder $query): Builder
    {
        return $query->where('is_active', true)
            ->where(fn ($q) => $q->whereNull('ends_at')->orWhere('ends_at', '>', now()))
            ->orderBy('sort_order')
            ->orderBy('id');
    }

    public function toArray(): array
    {
        $category = $this->relationLoaded('category') ? $this->category : null;

        return [
            'id' => $this->id,
            'eyebrow' => $this->eyebrow,
            'heading' => $this->heading,
            'highlight' => $this->highlight,
            'description' => $this->description,
            'ends_label' => $this->ends_label,
            // With its offset, so every visitor's countdown runs to the same instant.
            'ends_at' => $this->ends_at?->toIso8601String(),
            'button_text' => $this->button_text,
            'button_url' => $this->button_url,
            'category' => $category ? ['id' => $category->id, 'name' => $category->name, 'slug' => $category->slug] : null,
            'theme' => in_array($this->theme, self::THEMES, true) ? $this->theme : 'coral',
            'is_active' => (bool) $this->is_active,
            'sort_order' => (int) $this->sort_order,
        ];
    }
}
