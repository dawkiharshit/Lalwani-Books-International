<?php

namespace App\Support;

use App\Models\Setting;

/**
 * The photo shown beside each testimonial (admin → Testimonials).
 *
 * Kept as a list in settings, not as a column on testimonials: the live
 * database is only ever changed through the admin panel, so a new column
 * would need a migration run there by hand (see GiftIdeas).
 */
final class TestimonialPhotos
{
    public const KEY = 'testimonial_photos';

    /** @return array<int, string> testimonial id → stored path */
    public static function all(): array
    {
        $saved = json_decode((string) Setting::get(self::KEY, '{}'), true);
        if (! is_array($saved)) {
            return [];
        }

        $out = [];
        foreach ($saved as $id => $path) {
            if ((int) $id > 0 && is_string($path) && $path !== '') {
                $out[(int) $id] = $path;
            }
        }

        return $out;
    }

    public static function get(int $testimonialId): ?string
    {
        return self::all()[$testimonialId] ?? null;
    }

    /** Save a testimonial's photo, or pass null to take it off the list. */
    public static function set(int $testimonialId, ?string $path): void
    {
        $all = self::all();
        if ($path) {
            $all[$testimonialId] = $path;
        } else {
            unset($all[$testimonialId]);
        }

        Setting::set(self::KEY, json_encode($all));
    }
}
