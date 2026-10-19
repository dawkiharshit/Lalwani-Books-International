<?php

namespace App\Support;

/** Where an uploaded picture lives, as the storefront should ask for it. */
final class Media
{
    /**
     * Root-relative for our own uploads ("storage/x" → "/storage/x"): the
     * Next.js shop proxies /storage/* to this backend, so they stay
     * same-origin on every page. Anything else (a Google profile picture) is
     * already a full address and is passed through untouched.
     */
    public static function url(?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        return str_starts_with($path, 'storage/') ? '/'.$path : $path;
    }

    /** True for a file this shop stores, as opposed to someone else's URL. */
    public static function isOurs(?string $path): bool
    {
        return (bool) $path && str_starts_with($path, 'storage/');
    }
}
