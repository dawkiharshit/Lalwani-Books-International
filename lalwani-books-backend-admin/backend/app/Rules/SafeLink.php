<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * A link a shop page can safely render: a page on this site ("/collection?…")
 * or a full http(s) web address.
 *
 * Anything else is refused — javascript: and data: links, which would run in
 * a visitor's browser when clicked, and "//host" or "/\host", which browsers
 * treat as another website. Admin-entered buttons are the only links the
 * storefront takes from the database, so this is where the door is locked.
 */
class SafeLink implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if ($value === null || $value === '') {
            return;
        }

        $link = trim((string) $value);
        $sitePath = preg_match('~^/(?![/\\\\])\S*$~', $link) === 1;
        $webAddress = preg_match('~^https?://[^\s/$.?#]\S*$~i', $link) === 1;

        if (! $sitePath && ! $webAddress) {
            $fail('Use a page on this site (starting with /) or a web address starting with https://.');
        }
    }
}
