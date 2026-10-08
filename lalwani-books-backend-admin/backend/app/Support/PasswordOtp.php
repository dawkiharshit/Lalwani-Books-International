<?php

namespace App\Support;

use App\Mail\PasswordResetCode;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;

/**
 * Six-digit codes for "forgot password".
 *
 * Stored in Laravel's own password_reset_tokens table, hashed — the row that
 * used to hold a link token now holds a code, so no new table is needed.
 *
 * Deliberately separate from the signup code in EmailOtp: that one confirms an
 * address for someone already signed in, this one hands out a new password to
 * someone who is not. Sharing the columns would let a signup code change a
 * password.
 */
class PasswordOtp
{
    public const TTL_MINUTES = 10;
    public const RESEND_COOLDOWN_SECONDS = 60;
    private const MAX_ATTEMPTS = 5;

    /** Mint a code, store its hash, and email the plain one. */
    public static function send(User $user): void
    {
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        DB::table('password_reset_tokens')->updateOrInsert(
            ['email' => $user->email],
            ['token' => Hash::make($code), 'created_at' => now()]
        );

        // A fresh code starts a fresh budget of guesses.
        Cache::forget(self::attemptsKey($user->email));

        Mail::to($user->email)->send(new PasswordResetCode($user, $code));
    }

    /** Seconds before another code may be asked for, 0 when ready. */
    public static function cooldownRemaining(string $email): int
    {
        $row = DB::table('password_reset_tokens')->where('email', $email)->first();

        if (! $row) {
            return 0;
        }

        $ready = \Illuminate\Support\Carbon::parse($row->created_at)
            ->addSeconds(self::RESEND_COOLDOWN_SECONDS);

        return $ready->isFuture() ? (int) ceil(now()->diffInSeconds($ready, absolute: true)) : 0;
    }

    /**
     * Check a code. Consumes it on success so it can never be replayed.
     *
     * @return array{0: bool, 1: string} [ok, message when it failed]
     */
    public static function verify(string $email, string $code): array
    {
        $row = DB::table('password_reset_tokens')->where('email', $email)->first();

        if (! $row) {
            return [false, 'Ask for a new code — this one is no longer valid.'];
        }

        if (\Illuminate\Support\Carbon::parse($row->created_at)->addMinutes(self::TTL_MINUTES)->isPast()) {
            self::clear($email);

            return [false, 'That code has expired. Send yourself a new one.'];
        }

        $key = self::attemptsKey($email);

        if ((int) Cache::get($key, 0) >= self::MAX_ATTEMPTS) {
            self::clear($email);

            return [false, 'Too many wrong codes. Send yourself a new one.'];
        }

        if (! Hash::check($code, $row->token)) {
            // TTL matches the code, so the counter dies with it.
            Cache::put($key, (int) Cache::get($key, 0) + 1, now()->addMinutes(self::TTL_MINUTES));
            $left = self::MAX_ATTEMPTS - (int) Cache::get($key, 0);

            return [false, $left > 0
                ? "That code is not right. {$left} ".($left === 1 ? 'try' : 'tries').' left.'
                : 'Too many wrong codes. Send yourself a new one.'];
        }

        self::clear($email);

        return [true, ''];
    }

    private static function clear(string $email): void
    {
        DB::table('password_reset_tokens')->where('email', $email)->delete();
        Cache::forget(self::attemptsKey($email));
    }

    private static function attemptsKey(string $email): string
    {
        return 'pwotp_attempts:'.sha1(mb_strtolower($email));
    }
}
