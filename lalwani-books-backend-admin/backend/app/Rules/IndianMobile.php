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
    /** @param string $message What to say when it is not one — the courier's wording unless a screen needs its own. */
    public function __construct(private string $message = 'Enter a 10-digit mobile number the courier can call.') {}

    /** "+91 98765-43210" → "9876543210"; null when it is not a mobile number. */
    public static function digits(mixed $value): ?string
    {
        $digits = preg_replace('/\D/', '', is_scalar($value) ? (string) $value : '');

        // Callers write the same number with or without a country or trunk
        // prefix; both mean the same ten digits.
        if (str_starts_with($digits, '91') && strlen($digits) === 12) {
            $digits = substr($digits, 2);
        } elseif (str_starts_with($digits, '0') && strlen($digits) === 11) {
            $digits = substr($digits, 1);
        }

        return preg_match('/^[6-9]\d{9}$/', $digits) ? $digits : null;
    }

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (self::digits($value) === null) {
            $fail($this->message);
        }
    }
}
