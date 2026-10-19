<?php

namespace App\Models;

use App\Support\Media;
use App\Support\TestimonialPhotos;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Testimonial extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name', 'designation', 'location', 'content', 'rating', 'is_active', 'sort_order',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'rating' => 'integer',
        'sort_order' => 'integer',
    ];

    public function scopeActive($query)
    {
        return $query->where('is_active', true)->orderBy('sort_order');
    }

    /** What the storefront and the admin list show, photo included. */
    public function toCard(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'designation' => $this->designation,
            'location' => $this->location,
            'content' => $this->content,
            'rating' => $this->rating,
            'is_active' => $this->is_active,
            'sort_order' => $this->sort_order,
            // Kept apart from the row itself — see TestimonialPhotos.
            'photo' => Media::url(TestimonialPhotos::get($this->id)),
        ];
    }
}
