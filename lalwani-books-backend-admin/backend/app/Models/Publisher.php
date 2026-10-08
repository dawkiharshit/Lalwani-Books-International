<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** A book's publisher: created in admin → Publishers, chosen on each book, listed on Publications. */
class Publisher extends Model
{
    protected $fillable = ['name', 'slug', 'logo', 'description', 'sort_order'];

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
            'description' => $this->description,
            'logo' => Product::imageUrl($this->logo),
            'sort_order' => $this->sort_order,
            // Present when the query counted them (withCount).
            'products_count' => $this->products_count ?? 0,
        ];
    }
}
