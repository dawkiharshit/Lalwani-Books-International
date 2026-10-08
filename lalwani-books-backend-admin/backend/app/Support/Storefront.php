<?php

namespace App\Support;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Tells the Next.js storefront to drop its page cache.
 *
 * Without this an admin edit sits behind the cache window and the owner
 * reloads twice wondering why nothing changed. Called after any write that a
 * visitor could see.
 *
 * Never allowed to break a save: the change is already in the database, so a
 * storefront that is down or misconfigured is logged and shrugged off.
 */
class Storefront
{
    public static function refresh(): void
    {
        $secret = (string) config('app.revalidate_secret');
        $base = (string) config('app.frontend_url');

        if ($secret === '' || $base === '') {
            return;
        }

        try {
            // Short timeout — the admin is waiting on this response.
            // Not /api/revalidate: on the live host the storefront's /api/*
            // is answered by this API's own folder, so it never reached Next.js.
            $res = Http::withHeaders(['x-revalidate-secret' => $secret])
                ->timeout(3)
                ->post($base.'/revalidate');

            // A refusal does not throw. Logged, because a storefront without the
            // secret refuses every refresh and edits silently wait out the cache.
            if (! $res->successful()) {
                Log::warning('Storefront cache refresh refused', [
                    'status' => $res->status(),
                    'body' => mb_substr($res->body(), 0, 200),
                ]);
            }
        } catch (Throwable $e) {
            Log::warning('Storefront cache refresh failed', ['error' => $e->getMessage()]);
        }
    }
}
