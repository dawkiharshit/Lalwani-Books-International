<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Placing an order needs a signed-in customer.
 *
 * Not `auth:sanctum`: that answers "Unauthenticated.", and the storefront
 * shows the API's message as it is — this one reads as an instruction.
 */
class RequireSignIn
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user('sanctum')) {
            return response()->json(['message' => 'Please sign in to place your order.'], 401);
        }

        return $next($request);
    }
}
