<?php

namespace App\Support;

use App\Models\Setting;

/**
 * The books ticked "Gift idea" in admin → Products, which fill the Gift Ideas
 * shelf (home page → Discover).
 *
 * Kept as a list of book ids in settings, not as a column on products: the
 * live database is only changed through the admin panel, and a new column
 * would need a migration run there by hand.
 */
final class GiftIdeas
{
    public const KEY = 'gift_idea_ids';

    /** @return int[] */
    public static function ids(): array
    {
        $ids = array_map('intval', explode(',', (string) Setting::get(self::KEY, '')));

        return array_values(array_unique(array_filter($ids, fn (int $id) => $id > 0)));
    }

    public static function has(int $productId): bool
    {
        return in_array($productId, self::ids(), true);
    }

    /** Put a book on the list, or take it off. */
    public static function mark(int $productId, bool $on): void
    {
        $ids = array_values(array_diff(self::ids(), [$productId]));
        if ($on) {
            $ids[] = $productId;
        }

        Setting::set(self::KEY, implode(',', $ids));
    }
}
