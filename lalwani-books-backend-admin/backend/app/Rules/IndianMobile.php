<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * A number the courier can actually ring.
 *
 * Accepts what people really type — "98765 43210", "+91 98765-43210",
 * "098765 43210" — and rejects what Shiprocket would later refuse.
 */
class IndianMobile implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $digits = preg_replace('/\D/', '', (string) $value);

        // Callers write the same number with or without a country or trunk
        // prefix; both mean the same ten digits.
        if (str_starts_with($digits, '91') && strlen($digits) === 12) {
            $digits = substr($digits, 2);
        } elseif (str_starts_with($digits, '0') && strlen($digits) === 11) {
            $digits = substr($digits, 1);
        }

        if (! preg_match('/^[6-9]\d{9}$/', $digits)) {
            $fail('Enter a 10-digit mobile number the courier can call.');
        }
    }
}
