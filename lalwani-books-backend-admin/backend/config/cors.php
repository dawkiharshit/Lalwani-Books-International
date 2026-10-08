<?php

/*
 * The storefront's origin, plus its www./bare twin.
 *
 * A custom domain answers on both lalwanibooks.com and www.lalwanibooks.com
 * unless one redirects to the other, and a browser treats those as two
 * different origins. Allowing only the exact FRONTEND_URL blocked every
 * client-side call — cart, sign-in, checkout — for anyone who arrived on the
 * other spelling, while the server-rendered pages still looked fine.
 *
 * Still exactly two origins, no wildcard. FRONTEND_URL itself stays a single
 * URL because Google sign-in returns to it and order emails link to it.
 *
 * rtrim because an Origin header never carries a trailing slash, so a
 * FRONTEND_URL saved with one would never have matched at all.
 */
$frontend = rtrim((string) env('FRONTEND_URL', 'http://localhost:3000'), '/');
$origins = [$frontend];

if (preg_match('#^(https?://)(www\.)?([^/:]+)(:\d+)?$#i', $frontend, $m)) {
    $host = $m[3];
    // localhost and bare IPs have no www twin worth allowing.
    if ($host !== 'localhost' && ! filter_var($host, FILTER_VALIDATE_IP)) {
        $origins[] = $m[1] . ($m[2] !== '' ? '' : 'www.') . $host . ($m[4] ?? '');
    }
}

// The admin panel is its own app on its own origin (admin.example.com), so it
// needs its own entry — without it every admin save is blocked in production.
if ($admin = rtrim((string) env('ADMIN_URL', ''), '/')) {
    $origins[] = $admin;
}

return [
    'paths' => ['api/*'],
    'allowed_methods' => ['*'],
    'allowed_origins' => $origins,
    // In local dev the browser is picky: 127.0.0.1 and localhost are different
    // origins, so a call from one is blocked when FRONTEND_URL names the other.
    // Accept both (any port) while developing; production stays strict — only
    // the two origins above.
    'allowed_origins_patterns' => env('APP_ENV') === 'local'
        ? ['#^http://(localhost|127\.0\.0\.1)(:\d+)?$#']
        : [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 3600,
    'supports_credentials' => false,
];
