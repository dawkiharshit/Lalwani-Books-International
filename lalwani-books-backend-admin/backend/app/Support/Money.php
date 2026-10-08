<?php

namespace App\Support;

class Money
{
    /**
     * Format an amount in the store currency using Indian digit grouping
     * (1,23,456 rather than 123,456) when the locale calls for it.
     */
    public static function format(float $amount): string
    {
        $decimals = (int) config('shop.decimals', 0);
        $symbol = config('shop.currency', '₹');

        return $symbol.self::group($amount, $decimals);
    }

    /** Lakh/crore grouping for en-IN; plain thousands grouping otherwise. */
    private static function group(float $amount, int $decimals): string
    {
        $negative = $amount < 0;
        $amount = abs($amount);

        if (! str_starts_with((string) config('shop.locale', 'en-IN'), 'en-IN')) {
            return ($negative ? '-' : '').number_format($amount, $decimals);
        }

        $rounded = number_format($amount, $decimals, '.', '');
        [$whole, $fraction] = array_pad(explode('.', $rounded), 2, '');

        if (strlen($whole) > 3) {
            $last3 = substr($whole, -3);
            $rest = substr($whole, 0, -3);
            $rest = preg_replace('/\B(?=(\d{2})+(?!\d))/', ',', $rest);
            $whole = $rest.','.$last3;
        }

        return ($negative ? '-' : '').$whole.($fraction !== '' ? '.'.$fraction : '');
    }
}
