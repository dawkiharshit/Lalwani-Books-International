<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Blog extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'title', 'slug', 'excerpt', 'content', 'thumbnail', 'user_id', 'author_name',
        'category', 'tags', 'is_active', 'is_featured', 'published_at',
        'meta_title', 'meta_description', 'views',
        // SEO — on-page + off-page/social.
        'focus_keyword', 'meta_keywords', 'canonical_url', 'noindex', 'nofollow',
        'og_title', 'og_description', 'og_image', 'twitter_card',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_featured' => 'boolean',
        'noindex' => 'boolean',
        'nofollow' => 'boolean',
        'published_at' => 'datetime',
        'views' => 'integer',
    ];

    /** Every SEO field, with the social image falling back to the cover. */
    public function seoPayload(): array
    {
        return [
            'meta_title' => $this->meta_title,
            'meta_description' => $this->meta_description,
            'focus_keyword' => $this->focus_keyword,
            'meta_keywords' => $this->meta_keywords,
            'canonical_url' => $this->canonical_url,
            'noindex' => (bool) $this->noindex,
            'nofollow' => (bool) $this->nofollow,
            'og_title' => $this->og_title,
            'og_description' => $this->og_description,
            'og_image' => $this->og_image ? Product::imageUrl($this->og_image) : null,
            'twitter_card' => $this->twitter_card ?: 'summary_large_image',
        ];
    }

    public function scopePublished($query)
    {
        return $query->where('is_active', true)
            ->where(fn ($q) => $q->whereNull('published_at')->orWhere('published_at', '<=', now()))
            ->orderByDesc('published_at')
            ->orderByDesc('id');
    }

    public function toCard(): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'slug' => $this->slug,
            'excerpt' => $this->excerpt,
            'thumbnail' => Product::imageUrl($this->thumbnail),
            'author_name' => $this->author_name,
            'category' => $this->category,
            'is_featured' => $this->is_featured,
            'published_at' => $this->published_at?->toIso8601String(),
            'views' => $this->views,
        ];
    }

    public function toDetail(): array
    {
        return array_merge($this->toCard(), [
            'content' => $this->content,
            // "a, b," must not end in an empty tag pill on the article page.
            'tags' => array_values(array_filter(array_map('trim', explode(',', (string) $this->tags)), 'strlen')),
        ], $this->seoPayload());
    }
}
