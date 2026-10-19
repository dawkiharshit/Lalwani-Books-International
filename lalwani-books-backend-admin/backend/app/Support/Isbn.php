<?php

namespace App\Support;

/**
 * ISBNs as people type them: with or without dashes and spaces, and in either
 * form. The 10-digit ISBN on older covers and the 13-digit one on the barcode
 * name the same book, so a search for one finds a book saved with the other.
 */
final class Isbn
{
    /** Only the digits (and a final X): "978-0-13-235088-4" → "9780132350884". */
    public static function digits(string $value): string
    {
        return strtoupper((string) preg_replace('/[^0-9Xx]/', '', $value));
    }

    /**
     * What to look for: the typed digits, plus the same book's other ISBN
     * when a complete, valid ISBN-10 or 978 ISBN-13 was typed.
     *
     * @return string[]
     */
    public static function variants(string $digits): array
    {
        $out = [$digits];
        if (preg_match('/^\d{9}[\dX]$/', $digits) && self::validTen($digits)) {
            $out[] = self::toThirteen($digits);
        } elseif (preg_match('/^978\d{10}$/', $digits) && self::checkThirteen(substr($digits, 0, 12)) === $digits[12]) {
            $out[] = self::toTen($digits);
        }

        return $out;
    }

    /** A complete ISBN-10 or ISBN-13 whose check digit is right. */
    public static function isValid(string $digits): bool
    {
        return (preg_match('/^\d{9}[\dX]$/', $digits) && self::validTen($digits))
            || (preg_match('/^97[89]\d{10}$/', $digits) && self::checkThirteen(substr($digits, 0, 12)) === $digits[12]);
    }

    /** "0132350882" → "9780132350884" */
    public static function toThirteen(string $ten): string
    {
        $core = '978'.substr($ten, 0, 9);

        return $core.self::checkThirteen($core);
    }

    /** "9780132350884" → "0132350882" (only 978 ISBNs have a 10-digit form). */
    public static function toTen(string $thirteen): string
    {
        $core = substr($thirteen, 3, 9);
        $sum = 0;
        for ($i = 0; $i < 9; $i++) {
            $sum += (int) $core[$i] * (10 - $i);
        }
        $check = (11 - $sum % 11) % 11;

        return $core.($check === 10 ? 'X' : (string) $check);
    }

    private static function checkThirteen(string $twelve): string
    {
        $sum = 0;
        for ($i = 0; $i < 12; $i++) {
            $sum += (int) $twelve[$i] * ($i % 2 ? 3 : 1);
        }

        return (string) ((10 - $sum % 10) % 10);
    }

    private static function validTen(string $ten): bool
    {
        $sum = 0;
        for ($i = 0; $i < 10; $i++) {
            $sum += ($ten[$i] === 'X' ? 10 : (int) $ten[$i]) * (10 - $i);
        }

        return $sum % 11 === 0;
    }
}
