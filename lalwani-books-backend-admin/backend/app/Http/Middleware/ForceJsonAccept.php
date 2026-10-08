<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Treat every API request as wanting JSON.
 *
 * This is a JSON API, but a browser hitting a URL directly sends
 * `Accept: text/html`. Without this, an unauthenticated call would try to
 * redirect to a `login` route the API never defines and surface as a 500;
 * a 404 or validation error would render as HTML. Forcing the header keeps
 * the whole API — success and error alike — answering in JSON.
 */
class ForceJsonAccept
{
    public function handle(Request $request, Closure $next): Response
    {
        $request->headers->set('Accept', 'application/json');

        return $next($request);
    }
}
