<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class Coupon extends Model
{
    protected $fillable = [
        'code', 'type', 'value', 'min_order', 'max_uses', 'used_count', 'expires_at', 'is_active', 'is_public',
    ];

    protected $casts = [
        'value' => 'float',
        'min_order' => 'float',
        'is_active' => 'boolean',
        'is_public' => 'boolean',
        'expires_at' => 'datetime',
    ];

    /**
     * Coupons fit to advertise on the storefront: switched on, marked public,
     * not expired, and not used up. Minimum-order is left out on purpose — a
     * shopper should see the offer and the spend it unlocks, not have it hidden.
     */
    public function scopeAdvertisable(Builder $query): Builder
    {
        return $query
            ->where('is_active', true)
            ->where('is_public', true)
            ->where(fn (Builder $q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->where(fn (Builder $q) => $q->whereNull('max_uses')->orWhereColumn('used_count', '<', 'max_uses'));
    }

    public function isValidFor(float $subtotal): array
    {
        if (! $this->is_active) {
            return [false, 'This coupon is no longer active.'];
        }
        if ($this->expires_at && $this->expires_at->isPast()) {
            return [false, 'This coupon has expired.'];
        }
        if ($this->max_uses !== null && $this->used_count >= $this->max_uses) {
            return [false, 'This coupon has reached its usage limit.'];
        }
        if ($subtotal < $this->min_order) {
            return [false, 'Minimum order of ₹'.number_format($this->min_order, 0).' required.'];
        }

        return [true, null];
    }

    public function discountFor(float $subtotal): float
    {
        $discount = $this->type === 'percent'
            ? $subtotal * ($this->value / 100)
            : $this->value;

        return round(min($discount, $subtotal), 2);
    }
}
