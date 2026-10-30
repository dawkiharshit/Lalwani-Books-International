<?php

use Illuminate\Support\Facades\Route;

/*
 * The backend has no pages of its own: the shop is a separate website that asks
 * it for books, orders and customers. Anyone who opens this address directly —
 * or a search engine that stumbles on it — gets one plain line saying so, and a
 * way to the shop.
 *
 * It is deliberately the simplest page the framework can serve.
 *
 * Plain text, not a template, because a template has to be compiled into
 * storage/framework/views first; and `withoutMiddleware('web')` because the web
 * group opens a session, which on this site means a database table. Either one
 * missing used to turn this address into a bare "500 | Server Error" — which
 * reads as "the whole backend is down" when in fact every /api/v1 address is
 * answering perfectly, since those run in the api group and touch neither.
 *
 * This page needs no session, no cookie and no CSRF token, so it keeps none of
 * them. The site-wide security headers still apply: they are global middleware,
 * not part of the web group.
 */
Route::get('/', function () {
    $shop = (string) config('app.frontend_url');
    $link = $shop !== ''
        ? '<p><a href="'.e($shop).'">Go to the shop</a></p>'
        : '';

    return response(
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        .'<meta name="viewport" content="width=device-width, initial-scale=1">'
        .'<meta name="robots" content="noindex, nofollow">'
        .'<title>Lalwani Books International — service</title>'
        .'<style>body{font-family:system-ui,Segoe UI,Arial,sans-serif;color:#0f1d2e;'
        .'margin:0;min-height:100vh;display:grid;place-items:center;text-align:center;padding:2rem}'
        .'p{margin:.4rem 0;color:#3a4757}a{color:#042b52}</style></head><body><div>'
        .'<h1>Lalwani Books International</h1>'
        .'<p>This address serves the shop with its books and orders. There is nothing to see here.</p>'
        .$link
        .'</div></body></html>',
        200,
        ['Content-Type' => 'text/html; charset=utf-8']
    );
})->withoutMiddleware('web');
