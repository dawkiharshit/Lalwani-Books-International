<?php

namespace App\Support;

use App\Models\Setting;
use Illuminate\Support\Facades\Crypt;
use Throwable;

/**
 * Credentials for every outbound integration, editable from the admin panel.
 *
 * Values live in the settings table so the shop owner never touches .env;
 * anything secret is encrypted at rest with APP_KEY and is never returned to
 * the browser. An env var still wins as a fallback, which keeps existing
 * deployments and CI working.
 *
 * Each integration is its own GROUP so payments, delivery and email are saved
 * and tested independently — a bad Shiprocket password can never block the
 * shop owner from fixing their Razorpay keys.
 */
class GatewayCredentials
{
    /** group => the keys it owns. One admin screen per group. */
    public const GROUPS = [
        'payment' => [
            'razorpay_key_id',
            'razorpay_key_secret',
            'razorpay_webhook_secret',
        ],
        'delivery' => [
            'shiprocket_email',
            'shiprocket_password',
            'shiprocket_pickup_location',
            'shiprocket_pickup_pin',
            'shiprocket_channel_id',
        ],
        'google' => [
            'google_client_id',
            'google_client_secret',
        ],
        'mail' => [
            'mail_host',
            'mail_port',
            'mail_username',
            'mail_password',
            'mail_encryption',
            'mail_from_address',
            'mail_from_name',
        ],
        // WhatsApp messages through AiGrowBot (admin → WhatsApp).
        'whatsapp' => [
            'aigrowbot_webhook_url',
            'aigrowbot_api_username',
            'aigrowbot_secret_key',
        ],
        // Order messages from the shop's own AiGrowBot templates (admin →
        // WhatsApp): the account name and a token from AiGrowBot → API Management.
        'whatsapp_api' => [
            'aigrowbot_tenant',
            'aigrowbot_api_token',
        ],
    ];

    /** Keys whose value must never leave the server. */
    public const SECRETS = [
        'razorpay_key_secret',
        'razorpay_webhook_secret',
        'shiprocket_password',
        'mail_password',
        'google_client_secret',
        'aigrowbot_secret_key',
        'aigrowbot_api_token',
    ];

    /** The keys belonging to one group, or [] for an unknown group. */
    public static function group(string $group): array
    {
        return self::GROUPS[$group] ?? [];
    }

    /**
     * The .env value for a credential, or '' when unset.
     *
     * Read through config/gateways.php rather than env(): under the live
     * `config:cache`, env() from app code returns its fallback, so every .env
     * credential used to read as unset in production.
     */
    private static function fromEnv(string $key): string
    {
        return (string) (config('gateways.env.'.$key) ?? '');
    }

    /** The group a key belongs to, if any. */
    public static function groupOf(string $key): ?string
    {
        foreach (self::GROUPS as $group => $keys) {
            if (in_array($key, $keys, true)) {
                return $group;
            }
        }

        return null;
    }

    /**
     * Has the admin disconnected this integration? Its details stay saved —
     * so "Connect again" brings it straight back — but nothing uses them.
     */
    public static function isOff(string $group): bool
    {
        return (string) Setting::get('gw_off_'.$group, '') === '1';
    }

    public static function setOff(string $group, bool $off): void
    {
        Setting::set('gw_off_'.$group, $off ? '1' : '');
    }

    /**
     * Read a credential: admin panel first, then .env. A disconnected
     * integration reads as not set up at all — .env included — everywhere
     * the shop asks.
     */
    public static function get(string $key, string $default = ''): string
    {
        $group = self::groupOf($key);

        return $group !== null && self::isOff($group) ? $default : self::saved($key, $default);
    }

    /** The value as saved, even while its integration is disconnected — for the admin screen. */
    public static function saved(string $key, string $default = ''): string
    {
        $stored = (string) Setting::get('gw_'.$key, '');

        if ($stored !== '') {
            return in_array($key, self::SECRETS, true) ? self::decrypt($stored) : $stored;
        }

        $env = self::fromEnv($key);

        return $env !== '' ? $env : $default;
    }

    public static function set(string $key, string $value): void
    {
        if ($value === '') {
            Setting::set('gw_'.$key, '');

            return;
        }

        Setting::set('gw_'.$key, in_array($key, self::SECRETS, true) ? Crypt::encryptString($value) : $value);
    }

    /** Is a value present at all (from either source)? */
    public static function has(string $key): bool
    {
        return self::get($key) !== '';
    }

    /** Where the value currently comes from — shown as a hint in the admin. */
    public static function source(string $key): string
    {
        if ((string) Setting::get('gw_'.$key, '') !== '') {
            return 'admin';
        }

        return self::fromEnv($key) !== '' ? 'env' : 'unset';
    }

    private static function decrypt(string $stored): string
    {
        try {
            return Crypt::decryptString($stored);
        } catch (Throwable) {
            // APP_KEY changed since this was saved — treat it as unset so the
            // admin is prompted to enter the value again.
            return '';
        }
    }
}
