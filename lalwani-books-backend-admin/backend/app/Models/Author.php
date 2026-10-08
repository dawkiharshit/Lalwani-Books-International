<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** A book's author: created in admin, chosen on each book, shown with a photo. */
class Author extends Model
{
    protected $fillable = ['name', 'slug', 'photo', 'bio', 'sort_order'];

    protected $casts = [
        'sort_order' => 'integer',
    ];

    public function products()
    {
        return $this->hasMany(Product::class);
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'bio' => $this->bio,
            'photo' => Product::imageUrl($this->photo),
            'sort_order' => $this->sort_order,
            // Present when the query counted them (withCount).
            'products_count' => $this->products_count ?? 0,
        ];
    }
}
