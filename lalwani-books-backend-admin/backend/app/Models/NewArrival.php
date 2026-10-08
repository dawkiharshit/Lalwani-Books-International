<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class NewArrival extends Model
{
    use SoftDeletes;

    protected $table = 'new_arrivals';

    protected $fillable = ['image_path', 'title', 'link_url', 'is_active', 'sort_order'];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function scopeActive($query)
    {
        return $query->where('is_active', true)->orderBy('sort_order');
    }

    public function toArray(): array
    {
        return array_merge(
            [
                'id' => $this->id,
                'image' => Product::imageUrl($this->image_path),
                'is_active' => $this->is_active,
                'sort_order' => $this->sort_order,
            ],
            collect(explode(',', 'title,link_url'))->mapWithKeys(fn ($c) => [$c => $this->{$c}])->all()
        );
    }
}
