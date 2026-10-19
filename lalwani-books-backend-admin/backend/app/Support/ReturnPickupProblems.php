<?php

namespace App\Support;

use App\Models\Setting;

/**
 * Why a return's courier pickup could not be booked — Shiprocket's own
 * words — for admin → Returns only.
 *
 * It used to be added to the return's admin note, which customers see on
 * their order page, so they were shown raw courier and system errors. Kept as
 * a list in settings rather than a column: the live database only changes
 * through the admin panel (see GiftIdeas).
 */
final class ReturnPickupProblems
{
    public const KEY = 'return_pickup_problems';

    /** Older notes carried the problem after this; it is split off on the way out. */
    public const LEGACY_MARKER = 'Pickup not auto-booked: ';

    /** Plenty for the returns still waiting on a pickup; the settings column holds 64 KB. */
    private const KEEP = 120;

    /** @return array<int, string> return id → problem */
    public static function all(): array
    {
        $saved = json_decode((string) Setting::get(self::KEY, '{}'), true);
        if (! is_array($saved)) {
            return [];
        }

        $out = [];
        foreach ($saved as $id => $problem) {
            if ((int) $id > 0 && is_string($problem) && $problem !== '') {
                $out[(int) $id] = $problem;
            }
        }

        return $out;
    }

    public static function get(int $returnId): ?string
    {
        return self::all()[$returnId] ?? null;
    }

    /** Note a return's problem, or pass null once it is solved. */
    public static function set(int $returnId, ?string $problem): void
    {
        $all = self::all();
        $had = isset($all[$returnId]);
        unset($all[$returnId]);

        $problem = trim((string) $problem);
        if ($problem === '' && ! $had) {
            return;
        }
        if ($problem !== '') {
            $all[$returnId] = mb_strimwidth($problem, 0, 400, '…');
        }

        // Newest last; only the latest are kept.
        Setting::set(self::KEY, json_encode(
            array_slice($all, -self::KEEP, null, true),
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        ));
    }
}
