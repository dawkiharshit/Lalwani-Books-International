<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReturnRequest extends Model
{
    protected $table = 'order_returns';

    protected $fillable = [
        'order_id', 'user_id', 'type', 'reason', 'note', 'items', 'photos',
        'status', 'admin_note', 'sr_return_order_id', 'sr_return_shipment_id',
        'return_awb', 'refund_id', 'refund_amount', 'refund_upi', 'refund_method',
        'refund_bank', 'resolved_at',
    ];

    protected $casts = [
        'items' => 'array',
        'photos' => 'array',
        // Where a refund is paid out — a UPI ID or bank account — is encrypted
        // at rest, so a copy of the database alone does not expose it.
        'refund_upi' => 'encrypted',
        'refund_bank' => 'encrypted:array',
        'refund_amount' => 'float',
        'resolved_at' => 'datetime',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /** The order plus the fields the admin/customer screens need to render. */
    public function toPayload(): array
    {
        return [
            'id' => $this->id,
            'order_number' => $this->order?->order_number,
            'type' => $this->type,
            'reason' => $this->reason,
            'note' => $this->note,
            'items' => $this->items,
            'photos' => collect($this->photos ?? [])
                ->map(fn ($p) => Product::imageUrl($p))
                ->filter()
                ->values()
                ->all(),
            'status' => $this->status,
            'admin_note' => $this->admin_note,
            'return_awb' => $this->return_awb,
            'pickup_booked' => (bool) $this->sr_return_shipment_id,
            'tracking_url' => $this->return_awb ? 'https://shiprocket.co/tracking/'.$this->return_awb : null,
            'refund_amount' => $this->refund_amount,
            'refund_method' => $this->refund_method,
            'refund_upi' => $this->refund_upi,
            'refund_bank' => $this->refund_bank,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
