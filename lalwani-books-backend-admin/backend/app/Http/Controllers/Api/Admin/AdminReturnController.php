<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ReturnRequest;
use App\Services\Razorpay;
use App\Services\Shiprocket;
use Illuminate\Http\Request;
use RuntimeException;

class AdminReturnController extends Controller
{
    /**
     * The order statuses appear in: pending first, resolved last.
     *
     * Spelled out as CASE rather than MySQL's FIELD(), which does not exist in
     * SQLite — this app runs on it, so FIELD() threw on every request and the
     * admin screen showed "No return requests yet" over a table that had rows.
     */
    private const STATUS_ORDER = ['requested', 'approved', 'completed', 'rejected'];

    /** Pending first, then the rest — freshest within each group. */
    public function index()
    {
        $case = 'CASE '.collect(self::STATUS_ORDER)
            ->map(fn ($s, $i) => "WHEN status = ? THEN {$i}")
            ->implode(' ').' ELSE '.count(self::STATUS_ORDER).' END';

        $rows = ReturnRequest::with('order')
            ->orderByRaw($case, self::STATUS_ORDER)
            ->latest()
            ->limit(200)
            ->get()
            ->map(fn (ReturnRequest $r) => array_merge($r->toPayload(), [
                'customer' => [
                    'name' => $r->order?->ship_name,
                    'email' => $r->order?->email,
                    'phone' => $r->order?->ship_phone,
                ],
                'order_total' => $r->order?->total,
                'payment_method' => $r->order?->payment_method,
                'payment_status' => $r->order?->payment_status,
            ]));

        return response()->json(['data' => $rows]);
    }

    /** Accept the return and try to book the reverse pickup with Shiprocket. */
    public function approve(Request $request, ReturnRequest $orderReturn)
    {
        if ($orderReturn->status !== 'requested') {
            return response()->json(['message' => 'This return is not pending.'], 422);
        }

        $orderReturn->status = 'approved';
        $orderReturn->admin_note = $request->input('admin_note');

        // Best-effort: approval stands even if the pickup can't be booked yet
        // (e.g. the shop return address isn't filled in). The admin sees why.
        if (Shiprocket::enabled()) {
            try {
                $res = Shiprocket::createReturnOrder($orderReturn->order, $orderReturn->items ?? []);
                $orderReturn->sr_return_order_id = $res['order_id'] ?? null;
                $orderReturn->sr_return_shipment_id = $res['shipment_id'] ?? null;
            } catch (RuntimeException $e) {
                $orderReturn->admin_note = trim(
                    ($orderReturn->admin_note ? $orderReturn->admin_note.' — ' : '')
                    .'Pickup not auto-booked: '.$e->getMessage()
                );
            }
        }

        $orderReturn->save();

        // Let the customer know. Best effort: the approval is already saved,
        // and a mail outage must not turn it into an error for the admin.
        $orderReturn->load('order');
        $to = $orderReturn->order?->email;
        $mailed = false;
        if ($to) {
            try {
                \Illuminate\Support\Facades\Mail::to($to)
                    ->send(new \App\Mail\ReturnApproved($orderReturn, $request->input('admin_note')));
                $mailed = true;
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('Return approval email failed', [
                    'return' => $orderReturn->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return response()->json([
            'data' => $orderReturn->fresh('order')->toPayload(),
            'message' => $mailed
                ? 'Return approved. The customer has been emailed.'
                : 'Return approved. The customer could not be emailed.',
        ]);
    }

    /** Retry the Shiprocket reverse pickup for an approved return (e.g. after
     *  the shop return address is finally filled in). */
    public function bookPickup(ReturnRequest $orderReturn)
    {
        if ($orderReturn->status !== 'approved') {
            return response()->json(['message' => 'Only an approved return can have a pickup booked.'], 422);
        }
        if ($orderReturn->sr_return_shipment_id) {
            return response()->json(['message' => 'A pickup is already booked for this return.'], 422);
        }

        abort_unless(Shiprocket::enabled(), 422, 'Shiprocket is not configured.');

        try {
            $res = Shiprocket::createReturnOrder($orderReturn->order, $orderReturn->items ?? []);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $orderReturn->sr_return_order_id = $res['order_id'] ?? null;
        $orderReturn->sr_return_shipment_id = $res['shipment_id'] ?? null;
        // The green "pickup booked" line conveys this now — clear the stale
        // "not auto-booked" warning rather than replacing it with a duplicate.
        $orderReturn->admin_note = null;
        $orderReturn->save();

        return response()->json([
            'data' => $orderReturn->fresh('order')->toPayload(),
            'message' => 'Reverse pickup booked with Shiprocket.',
        ]);
    }

    public function reject(Request $request, ReturnRequest $orderReturn)
    {
        $data = $request->validate(['admin_note' => ['nullable', 'string', 'max:500']]);

        $orderReturn->update([
            'status' => 'rejected',
            'admin_note' => $data['admin_note'] ?? 'Not eligible for return.',
            'resolved_at' => now(),
        ]);

        return response()->json([
            'data' => $orderReturn->fresh('order')->toPayload(),
            'message' => 'Return rejected.',
        ]);
    }

    /** Close it out: refund online payments through Razorpay; COD by hand. */
    public function complete(Request $request, ReturnRequest $orderReturn)
    {
        if ($orderReturn->status !== 'approved') {
            return response()->json(['message' => 'Approve the return first.'], 422);
        }

        $order = $orderReturn->order;

        // The admin can refund a partial amount (e.g. one item out of many);
        // it defaults to the full order total when left blank.
        $data = $request->validate([
            'refund_amount' => ['nullable', 'numeric', 'min:1', 'max:'.$order->total],
        ]);

        if ($orderReturn->type === 'refund') {
            $amount = isset($data['refund_amount']) ? (float) $data['refund_amount'] : (float) $order->total;

            if ($order->payment_status === 'paid' && $order->razorpay_payment_id && Razorpay::enabled()) {
                try {
                    $refund = Razorpay::refund($order, $amount);
                    $orderReturn->refund_id = $refund['id'] ?? null;
                    $orderReturn->refund_amount = isset($refund['amount']) ? $refund['amount'] / 100 : $amount;
                } catch (RuntimeException $e) {
                    return response()->json(['message' => $e->getMessage()], 422);
                }
            } else {
                // COD or no captured online payment — record the amount owed;
                // the shop pays it out over UPI/bank and this marks it done.
                $orderReturn->refund_amount = $amount;
            }

            $order->forceFill(['payment_status' => 'refunded'])->save();
        }

        $orderReturn->status = 'completed';
        $orderReturn->resolved_at = now();
        $orderReturn->save();

        if ($orderReturn->type !== 'refund') {
            return response()->json([
                'data' => $orderReturn->fresh('order')->toPayload(),
                'message' => 'Replacement marked done.',
            ]);
        }

        // Tell the customer the money has gone out. Best effort, as with the
        // approval email: the refund is already made and recorded.
        $mailed = false;
        if ($order->email) {
            try {
                \Illuminate\Support\Facades\Mail::to($order->email)
                    ->send(new \App\Mail\RefundProcessed($orderReturn->load('order')));
                $mailed = true;
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('Refund email failed', [
                    'return' => $orderReturn->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return response()->json([
            'data' => $orderReturn->fresh('order')->toPayload(),
            'message' => $mailed
                ? 'Return completed and refunded. The customer has been emailed.'
                : 'Return completed and refunded. The customer could not be emailed.',
        ]);
    }
}
