<?php

namespace App\Services;

use App\Support\GatewayCredentials;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * "Sign in with Google", spoken directly to Google's OAuth 2.0 endpoints.
 *
 * No SDK: the whole exchange is one redirect, one POST and one GET, and
 * skipping the dependency keeps setup to "paste two values".
 *
 * Credentials come from the admin panel first and .env second, the same way
 * the payment and delivery keys do.
 */
class GoogleOAuth
{
    private const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
    private const TOKEN_URL = 'https://oauth2.googleapis.com/token';
    private const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

    public static function enabled(): bool
    {
        return self::clientId() !== '' && self::clientSecret() !== '';
    }

    public static function clientId(): string
    {
        return GatewayCredentials::get('google_client_id');
    }

    private static function clientSecret(): string
    {
        return GatewayCredentials::get('google_client_secret');
    }

    /** Where Google sends the browser back. Must match the console exactly. */
    public static function redirectUri(): string
    {
        return rtrim((string) config('app.url'), '/').'/api/v1/auth/google/callback';
    }

    /** The Google consent screen URL, with an anti-CSRF state value. */
    public static function authUrl(string $state): string
    {
        return self::AUTH_URL.'?'.http_build_query([
            'client_id' => self::clientId(),
            'redirect_uri' => self::redirectUri(),
            'response_type' => 'code',
            'scope' => 'openid email profile',
            'state' => $state,
            // Ask every time rather than silently reusing a stale grant.
            'prompt' => 'select_account',
            'access_type' => 'online',
        ]);
    }

    /**
     * Swap the one-time code for tokens, then read the profile.
     *
     * @return array{sub:string,email:string,name:string,picture:?string,email_verified:bool}
     */
    public static function profileFromCode(string $code): array
    {
        $token = Http::asForm()->acceptJson()->timeout(20)->post(self::TOKEN_URL, [
            'code' => $code,
            'client_id' => self::clientId(),
            'client_secret' => self::clientSecret(),
            'redirect_uri' => self::redirectUri(),
            'grant_type' => 'authorization_code',
        ]);

        if (! $token->successful() || ! $token->json('access_token')) {
            Log::error('Google token exchange failed', ['body' => $token->body()]);
            throw new RuntimeException('Google sign-in failed. Please try again.');
        }

        $me = Http::withToken($token->json('access_token'))
            ->acceptJson()->timeout(20)
            ->get(self::USERINFO_URL);

        if (! $me->successful() || ! $me->json('sub')) {
            Log::error('Google userinfo failed', ['body' => $me->body()]);
            throw new RuntimeException('Google did not return a profile.');
        }

        $email = (string) $me->json('email');

        if ($email === '') {
            throw new RuntimeException('This Google account has no email address.');
        }

        return [
            'sub' => (string) $me->json('sub'),
            'email' => $email,
            'name' => (string) ($me->json('name') ?: strstr($email, '@', true)),
            'picture' => $me->json('picture'),
            'email_verified' => (bool) $me->json('email_verified'),
        ];
    }
}
