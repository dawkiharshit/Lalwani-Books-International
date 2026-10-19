<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ReturnRequest;
use App\Services\Razorpay;
use App\Services\Shiprocket;
use App\Support\ReturnPickupProblems;
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

        $rows = ReturnRequest::with('order.items')
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
                // The amount the Approve box starts from, for a refund awaiting a decision.
                'suggested_refund' => $r->type === 'refund' && $r->status === 'requested' ? $r->suggestedRefund() : null,
                // Why the courier pickup is not booked — admin only, never in the customer's view.
                'pickup_problem' => $r->pickupProblem(),
            ]));

        return response()->json(['data' => $rows]);
    }

    /** Accept the return and try to book the reverse pickup with Shiprocket. */
    public function approve(Request $request, ReturnRequest $orderReturn)
    {
        if ($orderReturn->status !== 'requested') {
            return response()->json(['message' => 'This return is not pending.'], 422);
        }

        // The refund the customer is told about in the approval email. The
        // admin can still change it when completing the refund.
        $data = $request->validate([
            'refund_amount' => ['nullable', 'numeric', 'min:1', 'max:'.(float) $orderReturn->order?->total],
            'admin_note' => ['nullable', 'string', 'max:500'],
        ]);

        $orderReturn->status = 'approved';
        $orderReturn->admin_note = $data['admin_note'] ?? null;
        if ($orderReturn->type === 'refund') {
            $orderReturn->refund_amount = round(isset($data['refund_amount'])
                ? (float) $data['refund_amount']
                : $orderReturn->suggestedRefund(), 2) ?: null;
        }

        // Best-effort: approval stands even if the pickup can't be booked yet
        // (e.g. the shop return address isn't filled in). The admin sees why —
        // kept apart from the note, which the customer reads on their order page.
        $problem = null;
        if (Shiprocket::enabled()) {
            try {
                $res = Shiprocket::createReturnOrder($orderReturn->order, $orderReturn->items ?? []);
                $orderReturn->sr_return_order_id = $res['order_id'] ?? null;
                $orderReturn->sr_return_shipment_id = $res['shipment_id'] ?? null;
            } catch (RuntimeException $e) {
                $problem = $e->getMessage();
            }
        }

        $orderReturn->save();
        ReturnPickupProblems::set($orderReturn->id, $problem);

        // Let the customer know — once the admin has their answer, as the email
        // takes seconds. The approval is already saved; a failure is listed on
        // admin → Email (SMTP).
        $orderReturn->load('order');
        $to = (string) $orderReturn->order?->email;
        if ($to !== '') {
            \App\Support\MailLater::send($to, new \App\Mail\ReturnApproved($orderReturn, $data['admin_note'] ?? null), 'Return approval', [
                'return' => $orderReturn->id,
            ]);
        }

        return response()->json([
            'data' => $this->adminPayload($orderReturn),
            'message' => $to !== ''
                ? 'Return approved. The customer is being emailed.'
                : 'Return approved. The order has no email address, so the customer was not emailed.',
        ]);
    }

    /** What admin → Returns shows: the customer's view plus what only the admin may see. */
    private function adminPayload(ReturnRequest $orderReturn): array
    {
        $fresh = $orderReturn->fresh('order');

        return $fresh->toPayload() + ['pickup_problem' => $fresh->pickupProblem()];
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
            ReturnPickupProblems::set($orderReturn->id, $e->getMessage());

            return response()->json(['message' => $e->getMessage()], 422);
        }

        $orderReturn->sr_return_order_id = $res['order_id'] ?? null;
        $orderReturn->sr_return_shipment_id = $res['shipment_id'] ?? null;
        // The green "pickup booked" line says it all now. Drop the old warning —
        // including one an older note still carries — and keep the admin's words.
        $orderReturn->admin_note = $orderReturn->customerNote();
        $orderReturn->save();
        ReturnPickupProblems::set($orderReturn->id, null);

        return response()->json([
            'data' => $this->adminPayload($orderReturn),
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
            'data' => $this->adminPayload($orderReturn),
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
            // Left blank: the amount the customer was told when it was approved.
            $amount = isset($data['refund_amount'])
                ? (float) $data['refund_amount']
                : (float) ($orderReturn->refund_amount ?: $order->total);

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
                'data' => $this->adminPayload($orderReturn),
                'message' => 'Replacement marked done.',
            ]);
        }

        // Tell the customer the money has gone out — after the admin has their
        // answer, as with the approval email. The refund is already recorded.
        $to = (string) $order->email;
        if ($to !== '') {
            \App\Support\MailLater::send($to, new \App\Mail\RefundProcessed($orderReturn->load('order')), 'Refund', [
                'return' => $orderReturn->id,
            ]);
        }

        return response()->json([
            'data' => $this->adminPayload($orderReturn),
            'message' => $to !== ''
                ? 'Return completed and refunded. The customer is being emailed.'
                : 'Return completed and refunded. The order has no email address, so the customer was not emailed.',
        ]);
    }
}
