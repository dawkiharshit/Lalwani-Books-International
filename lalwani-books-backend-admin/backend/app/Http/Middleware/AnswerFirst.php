<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Lets the browser use an answer the moment it arrives.
 *
 * Emails (App\Support\MailLater) and the storefront refresh run after the
 * response, in the same PHP process. The live server hands the response over
 * first (LiteSpeed finishes the request). PHP's built-in server — `php
 * artisan serve`, which runs the shop on the owner's computer — keeps the
 * connection open until that work is done, and without a length the browser
 * waits for the close: checkout waited for both of its emails. Given the
 * exact length, the browser has the whole answer as soon as it is written.
 */
class AnswerFirst
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if ($response instanceof StreamedResponse
            || $response instanceof BinaryFileResponse
            || $response->headers->has('Content-Length')
            || $response->headers->has('Transfer-Encoding')) {
            return $response;
        }

        $content = $response->getContent();
        if (is_string($content)) {
            $response->headers->set('Content-Length', (string) strlen($content));
        }

        return $response;
    }
}
