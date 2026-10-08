<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    public const STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

    /** How many days after delivery a customer may still ask to return. */
    public const RETURN_WINDOW_DAYS = 7;

    /**
     * Working days for a completed online refund to land back on the card.
     *
     * Razorpay reverses the charge as soon as the return is marked complete,
     * but the bank takes its own time to post it. Stated here once so the
     * order page and the Terms page cannot quote different numbers — they
     * previously had no shared source, and the Terms said "[refund days]".
     *
     * COD has no charge to reverse: those are paid out by hand to the UPI or
     * bank details the customer gives, so this window does not apply to them.
     */
    public const REFUND_DAYS = 7;

    protected $fillable = [
        'order_number', 'user_id', 'email', 'status', 'payment_method', 'payment_status',
        'subtotal', 'discount', 'shipping', 'tax', 'total', 'coupon_code',
        'ship_name', 'ship_phone', 'ship_address1', 'ship_address2', 'ship_city',
        'ship_state', 'ship_zip', 'ship_country', 'notes', 'placed_at', 'delivered_at',
    ];

    protected $casts = [
        'subtotal' => 'float',
        'discount' => 'float',
        'shipping' => 'float',
        'tax' => 'float',
        'total' => 'float',
        'placed_at' => 'datetime',
        'paid_at' => 'datetime',
        'shipped_at' => 'datetime',
        'delivered_at' => 'datetime',
        // Without these two the raw strings come back and every
        // optional(...)->format() on them silently yields nothing — which is
        // why invoices were printing with no date.
        'invoiced_at' => 'datetime',
        'cancelled_at' => 'datetime',
    ];

    public function items()
    {
        return $this->hasMany(OrderItem::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function returns()
    {
        return $this->hasMany(ReturnRequest::class);
    }

    public function latestReturn(): ?ReturnRequest
    {
        return $this->returns()->latest()->first();
    }

    /** Delivered, inside the window, and not already in an open return. */
    public function isReturnable(): bool
    {
        if ($this->status !== 'delivered' || ! $this->delivered_at) {
            return false;
        }

        if ($this->delivered_at->copy()->addDays(self::RETURN_WINDOW_DAYS)->isPast()) {
            return false;
        }

        // One open return at a time; a rejected one leaves the door open again.
        return ! $this->returns()->whereIn('status', ['requested', 'approved', 'completed'])->exists();
    }

    public function toSummary(): array
    {
        return [
            'id' => $this->id,
            'order_number' => $this->order_number,
            'status' => $this->status,
            'payment_method' => $this->payment_method,
            'payment_status' => $this->payment_status,
            'total' => $this->total,
            'items_count' => $this->items->sum('quantity'),
            'placed_at' => optional($this->placed_at)->toIso8601String(),
        ];
    }

    public function toDetail(): array
    {
        return [
            'id' => $this->id,
            'order_number' => $this->order_number,
            'email' => $this->email,
            'status' => $this->status,
            'payment_method' => $this->payment_method,
            'payment_status' => $this->payment_status,
            'subtotal' => $this->subtotal,
            'discount' => $this->discount,
            'shipping' => $this->shipping,
            'tax' => $this->tax,
            'total' => $this->total,
            'coupon_code' => $this->coupon_code,
            'placed_at' => optional($this->placed_at)->toIso8601String(),
            'shipping_address' => [
                'name' => $this->ship_name,
                'phone' => $this->ship_phone,
                'address1' => $this->ship_address1,
                'address2' => $this->ship_address2,
                'city' => $this->ship_city,
                'state' => $this->ship_state,
                'zip' => $this->ship_zip,
                'country' => $this->ship_country,
            ],
            'notes' => $this->notes,
            // Filled once a courier is booked. Null until then, so the order
            // page can simply not draw the block.
            'shipment' => $this->awb_code ? [
                'awb_code' => $this->awb_code,
                'courier_name' => $this->courier_name,
                'tracking_url' => $this->tracking_url,
                'shipped_at' => optional($this->shipped_at)->toIso8601String(),
            ] : null,
            'delivered_at' => optional($this->delivered_at)->toIso8601String(),
            // Everything the order page needs to draw the return controls.
            'returnable' => $this->isReturnable(),
            'return_window_days' => self::RETURN_WINDOW_DAYS,
            'refund_days' => self::REFUND_DAYS,
            'return' => optional($this->latestReturn())->toPayload(),
            'items' => $this->items->map(function ($item) {
                return [
                    'id' => $item->id,
                    'name' => $item->name,
                    'unit_price' => (float) $item->unit_price,
                    'quantity' => $item->quantity,
                    'total' => (float) $item->total,
                    'product' => $item->product ? $item->product->toCard() : null,
                ];
            })->values(),
        ];
    }
}
