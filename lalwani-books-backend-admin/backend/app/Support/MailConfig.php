<?php

namespace App\Support;

use App\Models\Setting;
use Illuminate\Support\Facades\Schema;
use Throwable;

/**
 * Pushes the SMTP details the shop owner entered in the admin panel into
 * Laravel's mail config, so mail actually leaves the server without anyone
 * editing .env.
 *
 * Admin values are only applied when a host has genuinely been saved — with
 * nothing stored, .env keeps working exactly as before.
 */
class MailConfig
{
    /**
     * Has the shop owner saved SMTP details in the admin panel (and not
     * disconnected them)? When not, the server's own mail setup in .env is used.
     */
    public static function configured(): bool
    {
        return ! GatewayCredentials::isOff('mail')
            && self::stored('mail_host') !== '' && self::stored('mail_from_address') !== '';
    }

    /**
     * Apply the stored SMTP details. Called once per request from
     * AppServiceProvider, so it must never throw on a half-installed app.
     */
    public static function apply(): void
    {
        try {
            // Before the first migration there is no settings table to read.
            if (! Schema::hasTable('settings') || ! self::configured()) {
                return;
            }
        } catch (Throwable) {
            return;
        }

        $port = (int) (self::stored('mail_port') ?: 587);
        $scheme = self::stored('mail_encryption');

        config([
            'mail.default' => 'smtp',
            'mail.mailers.smtp.transport' => 'smtp',
            'mail.mailers.smtp.host' => self::stored('mail_host'),
            'mail.mailers.smtp.port' => $port,
            'mail.mailers.smtp.username' => self::stored('mail_username') ?: null,
            'mail.mailers.smtp.password' => GatewayCredentials::get('mail_password') ?: null,
            'mail.mailers.smtp.scheme' => self::scheme($port, $scheme),
            'mail.from.address' => self::stored('mail_from_address'),
            'mail.from.name' => self::stored('mail_from_name') ?: config('app.name'),
        ]);
    }

    /**
     * Symfony's mailer reads "scheme": smtps opens with TLS straight away
     * (port 465); smtp connects in plain text and upgrades with STARTTLS
     * (587, 25, 2525).
     *
     * On the standard ports the port decides, not the Encryption dropdown:
     * "SSL" with port 587 makes us speak TLS to a server expecting plain
     * SMTP, and the connection dies with OpenSSL's "wrong version number".
     * The dropdown only matters on a non-standard port.
     */
    public static function scheme(int $port, string $encryption): string
    {
        return match (true) {
            $port === 465 => 'smtps',
            in_array($port, [587, 25, 2525], true) => 'smtp',
            default => $encryption === 'ssl' ? 'smtps' : 'smtp',
        };
    }

    /**
     * Can mail actually reach a customer's inbox right now?
     *
     * The "log" and "array" mailers accept a message and report success while
     * nothing leaves the server, so a caller that only checks for an exception
     * will happily tell someone a code is on its way when it was written to
     * storage/logs instead. Callers whose message is worth waiting for — a
     * signup code, say — should ask this first.
     */
    public static function deliverable(): bool
    {
        $mailer = (string) config('mail.default');

        if (in_array($mailer, ['log', 'array', 'null'], true)) {
            return false;
        }

        // An SMTP mailer with no host is the unconfigured Laravel default; it
        // fails at connect time rather than delivering.
        if ($mailer === 'smtp') {
            return trim((string) config('mail.mailers.smtp.host')) !== ''
                && trim((string) config('mail.from.address')) !== '';
        }

        return true;
    }

    /** The admin-panel value only — never the .env fallback. */
    private static function stored(string $key): string
    {
        return trim((string) Setting::get('gw_'.$key, ''));
    }
}
