<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Address extends Model
{
    /** Enough for home, work and a few gift addresses; stops runaway growth. */
    public const MAX_PER_USER = 10;

    protected $fillable = [
        'user_id', 'label', 'name', 'phone', 'address1', 'address2',
        'city', 'state', 'zip', 'country', 'is_default',
    ];

    protected $casts = ['is_default' => 'boolean'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /** The shape the storefront reads — field names match the checkout form. */
    public function toApi(): array
    {
        return [
            'id' => $this->id,
            'label' => $this->label,
            'name' => $this->name,
            'phone' => $this->phone,
            'address1' => $this->address1,
            'address2' => $this->address2,
            'city' => $this->city,
            'state' => $this->state,
            'zip' => $this->zip,
            'country' => $this->country,
            'is_default' => $this->is_default,
        ];
    }

    /**
     * Make this the user's one default address. Done as two writes in a
     * transaction so there is never a moment with two defaults or none.
     */
    public function makeDefault(): void
    {
        \Illuminate\Support\Facades\DB::transaction(function () {
            static::where('user_id', $this->user_id)
                ->whereKeyNot($this->id)
                ->update(['is_default' => false]);
            $this->update(['is_default' => true]);
        });
    }

    /**
     * Remember the address an order shipped to, so the next checkout is
     * prefilled. Skips one the user already has (compared loosely: case and
     * spacing differences are the same place), and the first one saved
     * becomes the default.
     */
    public static function rememberFromOrder(Order $order): void
    {
        if (! $order->user_id) {
            return;
        }

        $norm = fn ($v) => preg_replace('/\s+/', ' ', mb_strtolower(trim((string) $v)));
        $existing = static::where('user_id', $order->user_id)->get();

        $already = $existing->contains(fn (self $a) => $norm($a->address1) === $norm($order->ship_address1)
            && $norm($a->address2) === $norm($order->ship_address2)
            && $norm($a->city) === $norm($order->ship_city)
            && $norm($a->zip) === $norm($order->ship_zip)
            && $norm($a->name) === $norm($order->ship_name)
            && preg_replace('/\D/', '', $a->phone) === preg_replace('/\D/', '', (string) $order->ship_phone));

        if ($already || $existing->count() >= self::MAX_PER_USER) {
            return;
        }

        static::create([
            'user_id' => $order->user_id,
            'name' => $order->ship_name,
            'phone' => $order->ship_phone,
            'address1' => $order->ship_address1,
            'address2' => $order->ship_address2,
            'city' => $order->ship_city,
            'state' => $order->ship_state,
            'zip' => $order->ship_zip,
            'country' => $order->ship_country ?: 'India',
            'is_default' => $existing->isEmpty(),
        ]);
    }
}
