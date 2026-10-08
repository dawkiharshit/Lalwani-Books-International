<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Banner extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'image_path', 'image_2_path', 'image_3_path', 'title', 'subtitle', 'badge_text', 'description',
        'button_text', 'button_url', 'show_text', 'is_active', 'sort_order',
    ];

    /** The three cover slots of the hero stack: front, left, right. */
    public const COVER_COLUMNS = ['image_path', 'image_2_path', 'image_3_path'];

    protected $casts = [
        'show_text' => 'boolean',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function scopeActive($query)
    {
        return $query->where('is_active', true)->orderBy('sort_order');
    }

    public function toArray(): array
    {
        $covers = array_map(fn ($column) => Product::imageUrl($this->$column), self::COVER_COLUMNS);

        return [
            'id' => $this->id,
            // The front cover, kept for older readers of this payload.
            'image' => $covers[0],
            // Front, left, right — null where a slot is empty.
            'covers' => $covers,
            'title' => $this->title,
            'subtitle' => $this->subtitle,
            'badge_text' => $this->badge_text,
            'description' => $this->description,
            'button_text' => $this->button_text,
            'button_url' => $this->button_url,
            'show_text' => $this->show_text,
            'is_active' => $this->is_active,
            'sort_order' => $this->sort_order,
        ];
    }
}
