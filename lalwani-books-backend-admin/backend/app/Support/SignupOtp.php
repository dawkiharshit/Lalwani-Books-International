<?php

namespace App\Support;

use App\Mail\EmailOtpCode;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;

/**
 * Sign-up held back until the email address is proven.
 *
 * Creating an account takes two steps, like "forgot password": the form, then
 * the six-digit code mailed to the address. Until the code is entered no
 * account exists. The details wait here, in the cache, with the password
 * already hashed and only the code's hash kept, so neither can be read back.
 *
 * A pending sign-up lives 30 minutes (each resend renews it). Each code lives
 * 10 minutes and allows five guesses; after that the customer asks for a new
 * code, keeping the details they already typed.
 */
class SignupOtp
{
    public const CODE_TTL_MINUTES = EmailOtp::TTL_MINUTES;
    public const PENDING_TTL_MINUTES = 30;
    public const RESEND_COOLDOWN_SECONDS = 60;
    public const MAX_ATTEMPTS = 5;

    /**
     * Hold the details and mail a code. Within the resend cooldown the details
     * are updated but no new mail goes out (the code already sent still works),
     * so pressing the button twice cannot flood someone's inbox.
     *
     * @param  array{name: string, email: string, phone?: ?string, password: string}  $data
     * @return int seconds until another code may be sent
     */
    public static function start(array $data): int
    {
        $pending = self::get($data['email']);
        $details = [
            'name' => $data['name'],
            'email' => $data['email'],
            'phone' => $data['phone'] ?? null,
            'password' => Hash::make($data['password']),
        ];

        if ($pending && ($wait = self::cooldownRemaining($pending)) > 0) {
            self::put(array_merge($pending, $details));

            return $wait;
        }

        self::issue(array_merge($pending ?? [], $details));

        return self::RESEND_COOLDOWN_SECONDS;
    }

    /**
     * Mail a fresh code for a pending sign-up.
     *
     * @return array{0: string, 1: int} [status: sent|wait|missing, seconds to wait]
     */
    public static function resend(string $email): array
    {
        $pending = self::get($email);

        if (! $pending) {
            return ['missing', 0];
        }

        if (($wait = self::cooldownRemaining($pending)) > 0) {
            return ['wait', $wait];
        }

        self::issue($pending);

        return ['sent', self::RESEND_COOLDOWN_SECONDS];
    }

    /**
     * Check a code. On success the pending sign-up is consumed and its details
     * returned (password already hashed); otherwise null and the reason.
     *
     * @return array{0: ?array, 1: string}
     */
    public static function verify(string $email, string $code): array
    {
        $pending = self::get($email);

        if (! $pending) {
            return [null, 'This sign-up has expired. Fill in the form again.'];
        }

        if (empty($pending['code'])) {
            return [null, 'Ask for a new code — this one is no longer valid.'];
        }

        if (($pending['code_expires_at'] ?? 0) < now()->getTimestamp()) {
            self::put(array_merge($pending, ['code' => null]));

            return [null, 'That code has expired. Send yourself a new one.'];
        }

        if (! Hash::check($code, $pending['code'])) {
            $attempts = ($pending['attempts'] ?? 0) + 1;
            $left = self::MAX_ATTEMPTS - $attempts;
            // Out of guesses: the code dies, the typed details stay.
            self::put(array_merge($pending, ['attempts' => $attempts], $left > 0 ? [] : ['code' => null]));

            return [null, $left > 0
                ? "That code is not right. {$left} ".($left === 1 ? 'try' : 'tries').' left.'
                : 'Too many wrong codes. Send yourself a new one.'];
        }

        self::forget($email);

        return [$pending, ''];
    }

    /** Drop a pending sign-up (e.g. when its mail could not be sent). */
    public static function forget(string $email): void
    {
        Cache::forget(self::key($email));
    }

    /** Seconds until another code may be sent, 0 when ready. */
    public static function cooldownRemaining(array $pending): int
    {
        $ready = ($pending['sent_at'] ?? 0) + self::RESEND_COOLDOWN_SECONDS;

        return max(0, $ready - now()->getTimestamp());
    }

    /** Mint a code, keep its hash with the details, and mail the plain code. */
    private static function issue(array $pending): void
    {
        // random_int, not rand — this is a credential.
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        self::put(array_merge($pending, [
            'code' => Hash::make($code),
            'code_expires_at' => now()->addMinutes(self::CODE_TTL_MINUTES)->getTimestamp(),
            'sent_at' => now()->getTimestamp(),
            'attempts' => 0,
        ]));

        // An unsaved User only carries the name and address into the email; no
        // account is created here.
        $recipient = new User(['name' => $pending['name'], 'email' => $pending['email']]);
        Mail::to($pending['email'])->send(new EmailOtpCode($recipient, $code));
    }

    private static function get(string $email): ?array
    {
        $pending = Cache::get(self::key($email));

        return is_array($pending) ? $pending : null;
    }

    private static function put(array $pending): void
    {
        Cache::put(self::key($pending['email']), $pending, now()->addMinutes(self::PENDING_TTL_MINUTES));
    }

    private static function key(string $email): string
    {
        return 'signup_otp:'.sha1(mb_strtolower(trim($email)));
    }
}
