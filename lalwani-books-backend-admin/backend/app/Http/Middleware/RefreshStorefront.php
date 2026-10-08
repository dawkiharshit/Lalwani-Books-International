<?php

namespace App\Http\Middleware;

use App\Support\Storefront;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Drops the storefront's page cache after any successful admin write.
 *
 * Sitting on the whole admin group rather than in each controller means a
 * screen added later is covered without anyone remembering to wire it up.
 */
class RefreshStorefront
{
    public function handle(Request $request, Closure $next): Response
    {
        return $next($request);
    }

    /**
     * Runs after the response has been sent, so the admin never waits on the
     * round trip to Next.
     */
    public function terminate(Request $request, Response $response): void
    {
        // Reads change nothing, and a rejected write changed nothing either.
        if ($request->isMethod('GET') || $response->getStatusCode() >= 300) {
            return;
        }

        Storefront::refresh();
    }
}
