<?php

namespace App\Models;

use App\Support\ReturnPickupProblems;
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

    /**
     * What this return would usually pay back — the starting figure the admin
     * sees when approving it: the whole order total when everything comes
     * back, otherwise the returned books at the price paid, less their share
     * of any discount and with their share of the tax. Shipping is kept.
     */
    public function suggestedRefund(): float
    {
        $order = $this->order;
        if (! $order) {
            return 0.0;
        }

        $lines = $order->loadMissing('items')->items;
        $returned = collect($this->items ?? [])->filter(fn ($r) => is_array($r));
        $lineFor = fn (array $r) => $lines->first(fn ($l) => ! empty($r['product_id']) && (int) $l->product_id === (int) $r['product_id'])
            ?? $lines->first(fn ($l) => $l->name === ($r['name'] ?? null));

        $everythingBack = $lines->isNotEmpty() && $lines->every(fn ($l) => $returned
            ->filter(fn ($r) => $lineFor($r)?->is($l))
            ->sum(fn ($r) => (int) ($r['quantity'] ?? 1)) >= (int) $l->quantity);

        if ($everythingBack) {
            return round((float) $order->total, 2);
        }

        $value = $returned->sum(function ($r) use ($lineFor) {
            $line = $lineFor($r);

            return $line ? (float) $line->unit_price * min(max(1, (int) ($r['quantity'] ?? 1)), (int) $line->quantity) : 0;
        });
        $subtotal = (float) $order->subtotal;
        $share = $subtotal > 0 ? $value / $subtotal : 0;
        $amount = $value - (float) $order->discount * $share + (float) $order->tax * $share;

        return round(max(0, min($amount, (float) $order->total)), 2);
    }

    /**
     * The admin's note as the customer may read it — never a courier or
     * system error. Older notes had the pickup error added after a " — ";
     * that part is left off.
     */
    public function customerNote(): ?string
    {
        $note = (string) $this->admin_note;
        $at = mb_strpos($note, ReturnPickupProblems::LEGACY_MARKER);
        if ($at !== false) {
            $note = preg_replace('/\s*—\s*$/u', '', mb_substr($note, 0, $at)) ?? '';
        }
        $note = trim($note);

        return $note !== '' ? $note : null;
    }

    /** Why the courier pickup could not be booked — for admin → Returns only. */
    public function pickupProblem(): ?string
    {
        if ($this->sr_return_shipment_id) {
            return null;
        }

        if ($problem = ReturnPickupProblems::get((int) $this->id)) {
            return $problem;
        }

        $note = (string) $this->admin_note;
        $at = mb_strpos($note, ReturnPickupProblems::LEGACY_MARKER);

        if ($at === false) {
            return null;
        }
        $problem = trim(mb_substr($note, $at + mb_strlen(ReturnPickupProblems::LEGACY_MARKER)));

        return $problem !== '' ? $problem : null;
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
            // Customers see this on their order page: the admin's words only.
            'admin_note' => $this->customerNote(),
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
