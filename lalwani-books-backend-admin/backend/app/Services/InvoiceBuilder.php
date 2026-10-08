<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Setting;
use App\Support\Money;

/**
 * Builds a GST invoice for one order.
 *
 * The order stores a single tax figure; India needs it split, so the same
 * amount is presented as CGST+SGST for a buyer in the seller's own state and
 * as IGST for anyone else. Nothing is recalculated — the split always adds
 * back up to the tax that was charged at checkout.
 */
class InvoiceBuilder
{
    /** Assign an invoice number the first time one is needed, then reuse it. */
    public static function numberFor(Order $order): string
    {
        if ($order->invoice_number) {
            return $order->invoice_number;
        }

        $prefix = trim((string) Setting::get('invoice_prefix', 'INV')) ?: 'INV';
        $year = ($order->placed_at ?? $order->created_at)->format('Y');
        $seq = str_pad((string) $order->id, 5, '0', STR_PAD_LEFT);
        $number = "{$prefix}-{$year}-{$seq}";

        $order->forceFill(['invoice_number' => $number, 'invoiced_at' => now()])->save();

        return $number;
    }

    public static function build(Order $order): array
    {
        // items.product carries the HSN code each line needs.
        $order->loadMissing('items.product');

        $sellerState = trim((string) Setting::get('invoice_state', ''));
        $buyerState = trim((string) $order->ship_state);
        $intra = $sellerState !== '' && strcasecmp($sellerState, $buyerState) === 0;

        $tax = (float) $order->tax;
        $rate = (float) Setting::get('tax_rate', config('shop.tax_rate', \App\Http\Controllers\Api\CheckoutController::TAX_RATE)) * 100;

        $taxLines = $intra
            ? [
                ['label' => 'CGST @ '.self::pct($rate / 2), 'amount' => round($tax / 2, 2)],
                ['label' => 'SGST @ '.self::pct($rate / 2), 'amount' => round($tax - round($tax / 2, 2), 2)],
            ]
            : [['label' => 'IGST @ '.self::pct($rate), 'amount' => round($tax, 2)]];

        return [
            'invoice_number' => self::numberFor($order),
            'invoice_date' => optional($order->invoiced_at ?? $order->placed_at ?? $order->created_at)->format('d M Y'),
            'order_number' => $order->order_number,
            'order_date' => optional($order->placed_at ?? $order->created_at)->format('d M Y'),
            'status' => $order->status,
            'payment_status' => $order->payment_status,
            'payment_method' => $order->payment_method === 'razorpay' ? 'Online (Razorpay)' : 'Cash on Delivery',
            // Customers type their state however they like — "delhi", "DELHI".
            'place_of_supply' => $buyerState ? mb_convert_case($buyerState, MB_CASE_TITLE, 'UTF-8') : '—',
            'tax_type' => $intra ? 'intra' : 'inter',

            'seller' => [
                'name' => Setting::get('invoice_seller_name', Setting::get('site_name', 'Lalwani Books International')),
                'address' => Setting::get('invoice_address', ''),
                'state' => $sellerState,
                'gstin' => Setting::get('invoice_gstin', ''),
                'email' => Setting::get('invoice_email', Setting::get('support_email', '')),
                'phone' => Setting::get('invoice_phone', Setting::get('support_phone', '')),
            ],

            'buyer' => [
                'name' => $order->ship_name,
                'email' => $order->email,
                'phone' => $order->ship_phone,
                'address' => array_values(array_filter([
                    $order->ship_address1,
                    $order->ship_address2,
                    trim($order->ship_city.', '.$order->ship_state.' '.$order->ship_zip),
                    $order->ship_country ?: 'India',
                ])),
            ],

            'items' => $order->items->map(fn ($i) => [
                'name' => $i->name,
                // Read live from the product: a code entered after the sale
                // still lands on the invoice, which is what an admin fixing a
                // missing HSN expects to happen.
                'hsn_code' => $i->product?->hsn_code,
                'quantity' => (int) $i->quantity,
                'unit_price' => (float) $i->unit_price,
                'total' => (float) $i->total,
            ])->values()->all(),

            'totals' => [
                'subtotal' => (float) $order->subtotal,
                'discount' => (float) $order->discount,
                'coupon_code' => $order->coupon_code,
                'shipping' => (float) $order->shipping,
                'taxable_value' => round(max($order->subtotal - $order->discount, 0) + $order->shipping, 2),
                'tax_lines' => $taxLines,
                'tax' => $tax,
                'total' => (float) $order->total,
                'total_in_words' => self::inWords((float) $order->total),
            ],

            'currency' => config('shop.currency', '₹'),
            'notes' => Setting::get('invoice_terms', ''),
        ];
    }

    private static function pct(float $v): string
    {
        return rtrim(rtrim(number_format($v, 2, '.', ''), '0'), '.').'%';
    }

    /** Indian-format amount in words, e.g. "Seven Thousand Seventy Nine Rupees Only". */
    public static function inWords(float $amount): string
    {
        $rupees = (int) floor($amount);
        $paise = (int) round(($amount - $rupees) * 100);

        $words = self::numberToWords($rupees).' Rupees';

        if ($paise > 0) {
            $words .= ' and '.self::numberToWords($paise).' Paise';
        }

        return $words.' Only';
    }

    private static function numberToWords(int $n): string
    {
        if ($n === 0) {
            return 'Zero';
        }

        $ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
            'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
            'Eighteen', 'Nineteen'];
        $tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

        $two = function (int $v) use ($ones, $tens): string {
            if ($v < 20) {
                return $ones[$v];
            }

            return trim($tens[intdiv($v, 10)].' '.$ones[$v % 10]);
        };

        $three = function (int $v) use ($two, $ones): string {
            $out = '';
            if ($v >= 100) {
                $out = $ones[intdiv($v, 100)].' Hundred';
                $v %= 100;
                if ($v) {
                    $out .= ' ';
                }
            }

            return trim($out.($v ? $two($v) : ''));
        };

        // Indian grouping: crore, lakh, thousand, hundred.
        $parts = [];
        foreach ([['Crore', 10000000], ['Lakh', 100000]] as [$label, $div]) {
            if ($n >= $div) {
                $parts[] = $three(intdiv($n, $div)).' '.$label;
                $n %= $div;
            }
        }
        if ($n >= 1000) {
            $parts[] = $three(intdiv($n, 1000)).' Thousand';
            $n %= 1000;
        }
        if ($n > 0) {
            $parts[] = $three($n);
        }

        return implode(' ', $parts);
    }
}
