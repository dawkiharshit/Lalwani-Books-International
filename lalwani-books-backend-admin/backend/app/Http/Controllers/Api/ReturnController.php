<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\ReturnRequest;
use Illuminate\Http\Request;

class ReturnController extends Controller
{
    /**
     * A customer opens a return or replacement for a delivered order. Works for
     * a signed-in customer (their own order) or a guest who proves the order's
     * email. Photos come up as an upload; the item list as a JSON field.
     */
    public function store(Request $request, string $orderNumber)
    {
        $order = Order::where('order_number', $orderNumber)->firstOrFail();

        $user = $request->user('sanctum');
        $ownsIt = ($user && $order->user_id === $user->id)
            || (strtolower(trim((string) $request->input('email'))) === strtolower((string) $order->email));

        abort_unless($ownsIt, 403, 'This is not your order.');

        if (! $order->isReturnable()) {
            return response()->json([
                'message' => 'This order can’t be returned — it must be delivered and within '
                    .Order::RETURN_WINDOW_DAYS.' days, with no return already open.',
            ], 422);
        }

        $request->validate([
            'type' => ['required', 'in:refund,replacement'],
            'reason' => ['required', 'string', 'max:80'],
            'note' => ['nullable', 'string', 'max:1000'],
            'refund_method' => ['nullable', 'in:upi,bank'],
            'refund_upi' => ['nullable', 'string', 'max:120'],
            'refund_account_name' => ['nullable', 'string', 'max:120'],
            'refund_account_number' => ['nullable', 'string', 'max:30'],
            'refund_ifsc' => ['nullable', 'string', 'max:15'],
            'refund_bank_name' => ['nullable', 'string', 'max:120'],
            'photos' => ['nullable', 'array', 'max:5'],
            'photos.*' => ['image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ]);

        // A COD refund has no online payment to reverse — so collect where to
        // send it: either a UPI ID, or full bank details.
        $isCodRefund = $request->input('type') === 'refund' && $order->payment_method === 'cod';
        $refundMethod = null;
        $refundUpi = null;
        $refundBank = null;

        if ($isCodRefund) {
            $refundMethod = $request->input('refund_method');

            if ($refundMethod === 'upi') {
                $refundUpi = trim((string) $request->input('refund_upi'));
                if ($refundUpi === '') {
                    return response()->json(['message' => 'Enter your UPI ID for the refund.'], 422);
                }
            } elseif ($refundMethod === 'bank') {
                $refundBank = [
                    'account_name' => trim((string) $request->input('refund_account_name')),
                    'account_number' => trim((string) $request->input('refund_account_number')),
                    'ifsc' => strtoupper(trim((string) $request->input('refund_ifsc'))),
                    'bank_name' => trim((string) $request->input('refund_bank_name')),
                ];
                foreach ($refundBank as $value) {
                    if ($value === '') {
                        return response()->json(['message' => 'Fill in all bank details — account name, number, IFSC and bank name.'], 422);
                    }
                }
            } else {
                return response()->json(['message' => 'Choose how to receive your COD refund — UPI or bank transfer.'], 422);
            }
        }

        // Items ride along as a JSON string so they can share one multipart
        // request with the photo files.
        // A plain JSON body may send them as an array instead; accept both
        // rather than casting an array to string (that was a 500).
        $input = $request->input('items');
        $raw = is_array($input) ? $input : json_decode((string) $input, true);
        $items = collect(is_array($raw) ? $raw : [])
            ->map(fn ($i) => [
                'name' => (string) ($i['name'] ?? ''),
                'quantity' => max(1, (int) ($i['quantity'] ?? 1)),
                'product_id' => isset($i['product_id']) ? (int) $i['product_id'] : null,
            ])
            ->filter(fn ($i) => $i['name'] !== '')
            ->values()
            ->all();

        if (empty($items)) {
            return response()->json(['message' => 'Choose at least one item to return.'], 422);
        }

        $photos = [];
        foreach ($request->file('photos', []) as $file) {
            $photos[] = 'storage/'.$file->store('returns', 'public');
        }

        $return = ReturnRequest::create([
            'order_id' => $order->id,
            'user_id' => $order->user_id,
            'type' => $request->input('type'),
            'reason' => $request->input('reason'),
            'note' => $request->input('note'),
            'refund_method' => $refundMethod,
            'refund_upi' => $refundUpi,
            'refund_bank' => $refundBank,
            'items' => $items,
            'photos' => $photos,
            'status' => 'requested',
        ]);

        // Let the shop know a return is waiting — after the customer has their
        // answer, never blocking the request on it.
        if ($shopEmail = (string) \App\Models\Setting::get('support_email', '')) {
            \App\Support\MailLater::raw(
                $shopEmail,
                "Return requested — {$order->order_number}",
                "A return/replacement was requested for order {$order->order_number} ({$return->type}, reason: {$return->reason}). Review it in Admin → Returns.",
                'Return request note to the shop',
                ['order' => $order->order_number]
            );
        }

        return response()->json(['data' => $return->load('order')->toPayload()], 201);
    }
}
