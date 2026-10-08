<?php

namespace App\Support;

use App\Mail\EmailOtpCode;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;

/**
 * Six-digit signup codes.
 *
 * Only the hash is stored, so a database dump never yields a working code.
 * A code dies on first correct use, on expiry, or after five wrong guesses —
 * whichever comes first.
 */
class EmailOtp
{
    public const TTL_MINUTES = 10;
    public const RESEND_COOLDOWN_SECONDS = 60;
    public const MAX_ATTEMPTS = 5;

    /** Mint a code, store its hash, and email the plain one. */
    public static function send(User $user): void
    {
        // random_int, not rand — this is a credential.
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        $user->forceFill([
            'email_otp' => Hash::make($code),
            'email_otp_expires_at' => now()->addMinutes(self::TTL_MINUTES),
            'email_otp_sent_at' => now(),
            'email_otp_attempts' => 0,
        ])->save();

        Mail::to($user->email)->send(new EmailOtpCode($user, $code));
    }

    /** Seconds until another code may be requested, 0 when ready. */
    public static function cooldownRemaining(User $user): int
    {
        if (! $user->email_otp_sent_at) {
            return 0;
        }

        $ready = $user->email_otp_sent_at->addSeconds(self::RESEND_COOLDOWN_SECONDS);

        return $ready->isFuture() ? (int) ceil(now()->diffInSeconds($ready, absolute: true)) : 0;
    }

    /**
     * Check a code and mark the address verified.
     *
     * @return array{0: bool, 1: string} [ok, message when it failed]
     */
    public static function verify(User $user, string $code): array
    {
        if ($user->email_verified_at) {
            return [true, ''];
        }

        if (! $user->email_otp || ! $user->email_otp_expires_at) {
            return [false, 'Ask for a new code — this one is no longer valid.'];
        }

        if ($user->email_otp_expires_at->isPast()) {
            self::clear($user);

            return [false, 'That code has expired. Send yourself a new one.'];
        }

        if ($user->email_otp_attempts >= self::MAX_ATTEMPTS) {
            self::clear($user);

            return [false, 'Too many wrong codes. Send yourself a new one.'];
        }

        if (! Hash::check($code, $user->email_otp)) {
            $user->increment('email_otp_attempts');
            $left = self::MAX_ATTEMPTS - $user->email_otp_attempts;

            return [false, $left > 0
                ? "That code is not right. {$left} ".($left === 1 ? 'try' : 'tries').' left.'
                : 'Too many wrong codes. Send yourself a new one.'];
        }

        $user->forceFill(['email_verified_at' => now()])->save();
        self::clear($user);

        return [true, ''];
    }

    private static function clear(User $user): void
    {
        $user->forceFill([
            'email_otp' => null,
            'email_otp_expires_at' => null,
            'email_otp_attempts' => 0,
        ])->save();
    }
}
