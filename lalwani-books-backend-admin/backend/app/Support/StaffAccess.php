<?php

namespace App\Support;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Http\Request;

/**
 * Staff: people the owner lets into the admin panel, with only the areas the
 * owner ticks — and, area by area, whether their edits wait for the owner's
 * approval (StaffChanges) or go live at once.
 *
 * A staff member is an ordinary user account (is_admin stays false) listed
 * here. Kept in settings rather than a column: the live database only changes
 * through the admin panel (see GiftIdeas).
 */
final class StaffAccess
{
    public const KEY = 'staff_members';

    public const NONE = 'none';

    public const VIEW = 'view';

    /** May edit; each change waits for the owner's approval. */
    public const APPROVAL = 'approval';

    /** May edit; changes go live at once. */
    public const DIRECT = 'direct';

    public const LEVELS = [self::NONE, self::VIEW, self::APPROVAL, self::DIRECT];

    /**
     * The areas a staff member can be given, in the order of the admin
     * sidebar: label, what it covers, and the admin API paths it opens.
     * Integrations, staff and approvals are not here: they are the owner's.
     */
    public const AREAS = [
        'dashboard' => ['Dashboard', 'Sales figures on the dashboard.', ['stats']],
        'insights' => ['Search insights', 'What customers search for, and the books they could not find.', ['search-insights']],
        'products' => ['Products', 'Books, their photos and videos.', ['products']],
        'categories' => ['Categories, Authors & Publishers', 'The shop’s categories, authors and publishers.', ['categories', 'authors', 'publishers']],
        'orders' => ['Orders', 'Orders, shipping with Shiprocket, invoices and abandoned checkouts.', ['orders', 'shipping', 'abandoned-checkouts']],
        'returns' => ['Returns & Refunds', 'Return requests, pickups and refunds.', ['returns']],
        'coupons' => ['Coupons & Deals', 'Discount codes and the deals on the home page.', ['coupons', 'deals']],
        'reviews' => ['Reviews', 'Customer reviews of books.', ['reviews']],
        'content' => ['Website content', 'Home page, banners, promo band, spotlight, testimonials, stats, about, contact, blog, FAQ & policies, popup, branding, shipping & tax.', ['settings', 'banners', 'blogs', 'testimonials', 'content', 'branding']],
        'inbox' => ['Messages & Subscribers', 'Contact-form messages, voice queries and newsletter sign-ups.', ['messages', 'subscribers', 'voice-queries']],
    ];

    /** Lists every admin screen reads for its dropdowns — readable by any staff member. */
    public const SHARED_READS = ['settings', 'categories', 'authors', 'publishers', 'branding'];

    /** @return array<int, array{active: bool, areas: array<string, string>, added_at: ?string}> user id → entry */
    public static function all(): array
    {
        $saved = json_decode((string) Setting::get(self::KEY, '{}'), true);
        if (! is_array($saved)) {
            return [];
        }

        $out = [];
        foreach ($saved as $id => $entry) {
            if ((int) $id > 0 && is_array($entry)) {
                $out[(int) $id] = self::clean($entry);
            }
        }

        return $out;
    }

    /** The staff entry of an active staff member, or null. */
    public static function member(?User $user): ?array
    {
        if (! $user || $user->is_admin) {
            return null;
        }

        $entry = self::all()[$user->id] ?? null;

        return $entry && $entry['active'] ? $entry : null;
    }

    /** What this user may do in an area. */
    public static function level(User $user, string $area): string
    {
        return self::member($user)['areas'][$area] ?? self::NONE;
    }

    public static function save(int $userId, array $entry): void
    {
        $all = self::all();
        $all[$userId] = self::clean($entry + ($all[$userId] ?? []));
        Setting::set(self::KEY, json_encode($all, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    public static function remove(int $userId): void
    {
        $all = self::all();
        unset($all[$userId]);
        Setting::set(self::KEY, json_encode($all, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    /** The first part of an admin API path: "products" for /api/v1/admin/products/12/image. */
    public static function segment(Request $request): string
    {
        $path = preg_replace('#^api/v\d+/admin/?#', '', trim($request->path(), '/')) ?? '';

        return explode('/', $path)[0] ?? '';
    }

    /** The area an admin API path belongs to, or null for the owner's own pages. */
    public static function areaFor(string $segment): ?string
    {
        foreach (self::AREAS as $area => [, , $segments]) {
            if (in_array($segment, $segments, true)) {
                return $area;
            }
        }

        return null;
    }

    /** The areas as the admin screens show them. */
    public static function areas(): array
    {
        return collect(self::AREAS)
            ->map(fn (array $area, string $key) => ['key' => $key, 'label' => $area[0], 'covers' => $area[1]])
            ->values()
            ->all();
    }

    /** Only known areas and levels, so a saved entry can never grant more. */
    private static function clean(array $entry): array
    {
        $areas = [];
        foreach (array_keys(self::AREAS) as $area) {
            $level = $entry['areas'][$area] ?? self::NONE;
            $areas[$area] = in_array($level, self::LEVELS, true) ? $level : self::NONE;
        }

        return [
            'active' => (bool) ($entry['active'] ?? true),
            'areas' => $areas,
            'added_at' => is_string($entry['added_at'] ?? null) ? $entry['added_at'] : null,
        ];
    }
}
