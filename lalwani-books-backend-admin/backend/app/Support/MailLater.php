<?php

namespace App\Support;

use App\Jobs\DeliverEmail;
use App\Models\Setting;
use Illuminate\Mail\Mailable;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Emails sent once the page has already answered.
 *
 * The shop sends through Gmail's SMTP, where every message costs about
 * 2.5–4 seconds: connecting, the TLS handshake, logging in, sending. Sent
 * inside the request, that time was added to the click that caused it —
 * checkout waited for two of them. Now the page answers first:
 *
 * - On the live server the email goes out right after the response, in the
 *   same PHP process (Laravel's defer(); LiteSpeed has already handed the
 *   answer over, and other visitors are served by other processes).
 * - On the owner's computer PHP's built-in server answers one request at a
 *   time, so an email sent after one answer would hold up the next page. There
 *   a background mail sender (`php artisan queue:work`, started with the site)
 *   takes it instead; while one is running it says so with a heartbeat file.
 *
 * Not for the sign-up and password codes: the customer is waiting for those
 * anyway, and a failure has to be told to them there and then.
 *
 * As nobody is waiting on the page any more, a failure is kept where the admin
 * will see it — admin → Email (SMTP) lists the last few — as well as logged.
 */
final class MailLater
{
    private const FAILURES_KEY = 'mail_failures';

    /** @param  string  $what  what the email is, e.g. "Order confirmation" */
    public static function send(string $to, Mailable $mail, string $what, array $context = []): void
    {
        self::later($to, $what, $context, mail: $mail);
    }

    /** A short plain-text note, likewise after the response. */
    public static function raw(string $to, string $subject, string $text, string $what, array $context = []): void
    {
        self::later($to, $what, $context, subject: $subject, text: $text);
    }

    /** Send it now; a failure is logged and listed for the admin, never thrown. */
    public static function deliver(string $to, string $what, array $context = [], ?Mailable $mail = null, ?string $subject = null, ?string $text = null): void
    {
        try {
            $mail
                ? Mail::to($to)->send($mail)
                : Mail::raw((string) $text, fn ($m) => $m->to($to)->subject((string) $subject));
        } catch (Throwable $e) {
            Log::warning("{$what} email failed", $context + ['error' => $e->getMessage()]);
            self::remember($to, $what, $e->getMessage());
        }
    }

    /** The last emails that could not be sent, newest first. */
    public static function recentFailures(): array
    {
        $list = json_decode((string) Setting::get(self::FAILURES_KEY, '[]'), true);

        return is_array($list) ? array_values(array_filter($list, 'is_array')) : [];
    }

    /** Called by the background sender as it waits for work: "I am running". */
    public static function heartbeat(): void
    {
        $file = self::heartbeatFile();
        if (! is_file($file) || filemtime($file) < time() - 5) {
            @touch($file);
        }
    }

    /** Is a background mail sender running (it beat within the last 20 seconds)? */
    public static function senderRunning(): bool
    {
        if (app()->runningUnitTests() || config('queue.default') === 'sync') {
            return false;
        }

        $file = self::heartbeatFile();
        clearstatcache(true, $file);

        return is_file($file) && filemtime($file) >= time() - 20;
    }

    private static function later(string $to, string $what, array $context, ?Mailable $mail = null, ?string $subject = null, ?string $text = null): void
    {
        if (self::senderRunning()) {
            try {
                DeliverEmail::dispatch($to, $what, $context, $mail, $subject, $text);

                return;
            } catch (Throwable $e) {
                Log::warning('Could not hand an email to the background sender', ['what' => $what, 'error' => $e->getMessage()]);
            }
        }

        defer(fn () => self::deliver($to, $what, $context, $mail, $subject, $text));
    }

    /** One per database: a sender only takes the emails of the database it reads. */
    private static function heartbeatFile(): string
    {
        $database = (string) config('database.connections.'.config('database.default').'.database');

        return storage_path('framework/mail-sender-'.(preg_replace('/[^A-Za-z0-9_-]/', '', basename($database)) ?: 'default').'.alive');
    }

    /** Keep the failure for the admin screen — the recipient half hidden. */
    private static function remember(string $to, string $what, string $error): void
    {
        [$name, $domain] = array_pad(explode('@', $to, 2), 2, '');
        $entry = [
            'at' => now()->toIso8601String(),
            'what' => $what,
            'to' => mb_substr($name, 0, 2).'•••'.($domain !== '' ? '@'.$domain : ''),
            'error' => mb_strimwidth(trim(preg_replace('/\s+/', ' ', $error) ?? ''), 0, 200, '…'),
        ];

        try {
            Setting::set(self::FAILURES_KEY, json_encode(
                array_slice([$entry, ...self::recentFailures()], 0, 10),
                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
            ));
        } catch (Throwable) {
            // The log line above is the record; this list is a convenience.
        }
    }
}
