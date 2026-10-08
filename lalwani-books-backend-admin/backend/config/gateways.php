<?php

/*
|--------------------------------------------------------------------------
| Integration credentials from .env
|--------------------------------------------------------------------------
|
| The fallback layer for App\Support\GatewayCredentials: a value saved in
| Admin → Integrations always wins, and these are used only when nothing has
| been saved there.
|
| They are resolved here, in a config file, for one reason. The live deploy
| runs `config:cache`, after which Laravel stops reading .env and any env()
| call made from app code returns its fallback. These lookups used to live in
| the class as env($name), so on the live API every .env credential —
| Razorpay, Shiprocket, SMTP, Google — read as unset. Config files are the one
| place env() is evaluated at cache time, so the values survive.
|
| setting key => value from .env (null when the variable is not set)
|
*/

return [
    'env' => [
        'razorpay_key_id' => env('RAZORPAY_KEY_ID'),
        'razorpay_key_secret' => env('RAZORPAY_KEY_SECRET'),
        'razorpay_webhook_secret' => env('RAZORPAY_WEBHOOK_SECRET'),
        'shiprocket_email' => env('SHIPROCKET_EMAIL'),
        'shiprocket_password' => env('SHIPROCKET_PASSWORD'),
        'shiprocket_pickup_location' => env('SHIPROCKET_PICKUP_LOCATION'),
        'shiprocket_pickup_pin' => env('SHIPROCKET_PICKUP_PIN'),
        'shiprocket_channel_id' => env('SHIPROCKET_CHANNEL_ID'),
        'mail_host' => env('MAIL_HOST'),
        'mail_port' => env('MAIL_PORT'),
        'mail_username' => env('MAIL_USERNAME'),
        'mail_password' => env('MAIL_PASSWORD'),
        'mail_encryption' => env('MAIL_SCHEME'),
        'mail_from_address' => env('MAIL_FROM_ADDRESS'),
        'mail_from_name' => env('MAIL_FROM_NAME'),
        'google_client_id' => env('GOOGLE_CLIENT_ID'),
        'google_client_secret' => env('GOOGLE_CLIENT_SECRET'),
    ],

    // Shiprocket's API address. Without it every Shiprocket call went to a
    // bare path like "/auth/login" and failed with "URI must include a scheme
    // and host". Override only if Shiprocket ever moves its API.
    'shiprocket' => [
        'base' => env('SHIPROCKET_BASE_URL', 'https://apiv2.shiprocket.in/v1/external'),
    ],
];
