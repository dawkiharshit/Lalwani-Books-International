<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\EmailOtp;
use App\Support\MailConfig;
use App\Support\PasswordOtp;
use App\Support\SignupOtp;
use Illuminate\Http\Request;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Sign-up, step one: check the form and email a six-digit code. No account
     * is created yet — that happens in verifyRegistration(), once the code
     * proves the address belongs to whoever is signing up (the same two-step
     * shape as "forgot password").
     */
    public function register(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:190', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:30'],
            'password' => ['required', 'confirmed', Password::min(8)],
        ]);

        // Checked first: with no working mail the code can never arrive, and
        // nobody should be left waiting on it.
        if (! MailConfig::deliverable()) {
            Log::warning('Sign-up blocked: the shop has no working mail setup', ['mailer' => config('mail.default')]);

            return response()->json([
                'message' => 'We cannot send the confirmation email right now, so new accounts cannot be created. Please try again later.',
            ], 503);
        }

        try {
            $retryAfter = SignupOtp::start($data);
        } catch (\Throwable $e) {
            SignupOtp::forget($data['email']);
            Log::warning('Sign-up code could not be sent', ['error' => $e->getMessage()]);

            return response()->json([
                'message' => 'We could not send the confirmation email. Please check the address and try again.',
            ], 503);
        }

        return response()->json([
            'otp_required' => true,
            'email' => $data['email'],
            'message' => "We sent a 6-digit code to {$data['email']}.",
            'retry_after' => $retryAfter,
        ], 202);
    }

    /**
     * Sign-up, step two: the code from the email. Only now is the account
     * created — already confirmed — and the customer signed in.
     */
    public function verifyRegistration(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:190'],
            'code' => ['required', 'string', 'regex:/^\d{6}$/'],
        ]);

        [$pending, $message] = SignupOtp::verify($data['email'], $data['code']);

        if (! $pending) {
            throw ValidationException::withMessages(['code' => [$message]]);
        }

        // The address may have been taken meanwhile (e.g. through Google
        // sign-in). Never create a second account for it.
        if (User::where('email', $pending['email'])->exists()) {
            throw ValidationException::withMessages([
                'code' => ['This email already has an account. Sign in instead.'],
            ]);
        }

        // The password arrives already hashed; the model's "hashed" cast keeps
        // a value it recognises as a hash rather than hashing it twice.
        $user = User::create([
            'name' => $pending['name'],
            'email' => $pending['email'],
            'phone' => $pending['phone'],
            'password' => $pending['password'],
        ]);
        $user->forceFill(['email_verified_at' => now()])->save();

        $token = $user->createToken('lalwani-spa')->plainTextToken;

        return response()->json([
            'user' => $this->userPayload($user->fresh()),
            'token' => $token,
        ], 201);
    }

    /** Sign-up: mail a fresh code for a sign-up waiting on step two. */
    public function resendRegistration(Request $request)
    {
        $data = $request->validate(['email' => ['required', 'email', 'max:190']]);

        if (! MailConfig::deliverable()) {
            return response()->json([
                'message' => 'We cannot send email right now. Please try again later.',
            ], 503);
        }

        try {
            [$status, $wait] = SignupOtp::resend($data['email']);
        } catch (\Throwable $e) {
            Log::warning('Sign-up code could not be re-sent', ['error' => $e->getMessage()]);

            return response()->json(['message' => 'We could not send a new code. Please try again.'], 503);
        }

        return match ($status) {
            'missing' => response()->json(['message' => 'This sign-up has expired. Fill in the form again.'], 422),
            'wait' => response()->json([
                'message' => "Wait {$wait} seconds before asking for another code.",
                'retry_after' => $wait,
            ], 429),
            default => response()->json([
                'message' => "A new code is on its way to {$data['email']}.",
                'retry_after' => $wait,
            ]),
        };
    }

    /** Email a fresh six-digit code to the signed-in user. */
    public function sendOtp(Request $request)
    {
        $user = $request->user();

        if ($user->email_verified_at) {
            return response()->json(['message' => 'This address is already confirmed.'], 422);
        }

        if ($wait = EmailOtp::cooldownRemaining($user)) {
            return response()->json([
                'message' => "Wait {$wait} seconds before asking for another code.",
                'retry_after' => $wait,
            ], 429);
        }

        if (! $this->trySendOtp($user)) {
            return response()->json([
                'message' => 'The shop cannot send email yet. Ask the store owner to finish the email setup.',
            ], 503);
        }

        return response()->json(['message' => "Code sent to {$user->email}."]);
    }

    /** Check the code the customer typed. */
    public function verifyOtp(Request $request)
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'regex:/^\d{6}$/'],
        ]);

        $user = $request->user();
        [$ok, $message] = EmailOtp::verify($user, $data['code']);

        if (! $ok) {
            return response()->json(['message' => $message], 422);
        }

        return response()->json([
            'message' => 'Email confirmed.',
            'user' => $this->userPayload($user->fresh()),
        ]);
    }

    /**
     * Send a code, reporting failure instead of throwing — with SMTP not yet
     * configured this is the expected outcome, not an error worth a 500.
     */
    private function trySendOtp(User $user): bool
    {
        // Checked before sending, not after: the log mailer raises nothing, so
        // without this the customer is told a code is on its way when it only
        // reached storage/logs, and they sit waiting on a mail that cannot come.
        if (! MailConfig::deliverable()) {
            Log::warning('Signup OTP not delivered: the shop has no working mail setup', [
                'user' => $user->id,
                'mailer' => config('mail.default'),
            ]);

            return false;
        }

        try {
            EmailOtp::send($user);

            return true;
        } catch (\Throwable $e) {
            Log::warning('Signup OTP could not be sent', [
                'user' => $user->id,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        $token = $user->createToken('lalwani-spa')->plainTextToken;

        return response()->json([
            'user' => $this->userPayload($user),
            'token' => $token,
        ]);
    }

    /**
     * Email a reset link. The response never reveals whether the address is
     * registered — that would turn this into an account-enumeration oracle.
     */
    public function forgotPassword(Request $request)
    {
        $data = $request->validate(["email" => ["required", "email"]]);

        $user = User::where("email", $data["email"])->first();

        // Every branch below returns the same thing. Saying "no such account"
        // — or even taking noticeably longer — would let anyone test which
        // addresses are registered here.
        if ($user && PasswordOtp::cooldownRemaining($user->email) === 0) {
            try {
                PasswordOtp::send($user);
            } catch (\Throwable $e) {
                Log::warning("Password reset code could not be sent", [
                    "email" => $user->email,
                    "error" => $e->getMessage(),
                ]);
            }
        }

        return response()->json([
            "message" => "If that email is registered, a 6-digit code is on its way.",
        ]);
    }

    public function resetPassword(Request $request)
    {
        $data = $request->validate([
            "email" => ["required", "email"],
            "code" => ["required", "string", "regex:/^\d{6}$/"],
            "password" => ["required", "confirmed", Password::min(8)],
        ]);

        [$ok, $message] = PasswordOtp::verify($data["email"], $data["code"]);

        if (! $ok) {
            throw ValidationException::withMessages(["code" => [$message]]);
        }

        $user = User::where("email", $data["email"])->first();

        // The code was valid, so the account existed when it was issued. If it
        // has gone since, fail the same way rather than leaking that fact.
        if (! $user) {
            throw ValidationException::withMessages([
                "code" => ["Ask for a new code — this one is no longer valid."],
            ]);
        }

        $user->forceFill([
            "password" => $data["password"],
            "remember_token" => Str::random(60),
            // Whoever reset it proved they read the mailbox, so the address
            // is confirmed too.
            "email_verified_at" => $user->email_verified_at ?? now(),
        ])->save();

        // Any session opened with the old password is now void.
        $user->tokens()->delete();

        event(new PasswordReset($user));

        return response()->json(["message" => "Password updated. You can sign in now."]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out.']);
    }

    public function me(Request $request)
    {
        return response()->json(['user' => $this->userPayload($request->user())]);
    }

    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:190', 'unique:users,email,'.$user->id],
            'phone' => ['nullable', 'string', 'max:30'],
        ]);

        $previous = $user->email;
        $emailChanged = strcasecmp($data['email'], $previous) !== 0;

        $user->fill($data);
        if ($emailChanged) {
            // A new address starts unconfirmed: whoever controls the account
            // must prove they can read it before it counts as verified. Left
            // verified, a stolen session could re-point the account's recovery
            // address — and the password reset that goes with it — in one call.
            $user->email_verified_at = null;
            $user->email_otp = null;
            $user->email_otp_expires_at = null;
            $user->email_otp_attempts = 0;
        }
        $user->save();

        $otpSent = false;
        if ($emailChanged) {
            $otpSent = $this->trySendOtp($user);
            // The old address is told, so the real owner finds out at once if
            // the change was not theirs.
            $this->notifyEmailChanged($previous, $user);
        }

        return response()->json([
            'user' => $this->userPayload($user),
            'email_changed' => $emailChanged,
            'otp_sent' => $otpSent,
        ]);
    }

    /** Best effort: a notice to the address an account just moved away from. */
    private function notifyEmailChanged(string $previous, User $user): void
    {
        if (! MailConfig::deliverable()) {
            return;
        }

        try {
            MailConfig::apply();
            $store = \App\Models\Setting::get('site_name', 'Lalwani Books International');
            $support = (string) \App\Models\Setting::get('support_email', '');

            \Illuminate\Support\Facades\Mail::raw(
                "Hi {$user->name},\n\n"
                ."The email address on your {$store} account was changed to {$user->email}.\n\n"
                ."If you made this change, you can ignore this message. If you did not, "
                .'please contact us right away'.($support !== '' ? " at {$support}" : '').'.',
                fn ($m) => $m->to($previous)->subject("{$store} — your account email was changed")
            );
        } catch (\Throwable $e) {
            Log::warning('Email-change notice could not be sent', [
                'user' => $user->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    public function updatePassword(Request $request)
    {
        $user = $request->user();
        // A Google account has no password yet — it is setting one for the
        // first time, so there is no "current password" to confirm.
        $hasPassword = $user->password !== null;

        $data = $request->validate([
            'current_password' => [$hasPassword ? 'required' : 'nullable', 'string'],
            'password' => ['required', 'confirmed', Password::min(8)],
        ]);

        if ($hasPassword && ! Hash::check($data['current_password'] ?? '', $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Current password is incorrect.'],
            ]);
        }

        $user->update(['password' => $data['password']]);

        // Every other session opened with the old password is now void — the
        // point of changing a password that may have leaked. The session
        // making the change stays signed in.
        $user->tokens()->where('id', '!=', $user->currentAccessToken()->id)->delete();

        return response()->json([
            'message' => $hasPassword
                ? 'Password updated.'
                : 'Password set — you can now sign in with your email too.',
        ]);
    }

    private function userPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'is_admin' => (bool) $user->is_admin,
            'email_verified' => (bool) $user->email_verified_at,
            'avatar' => $user->avatar,
            // Google accounts have no password, so the UI must not offer
            // "change password" to them.
            'has_password' => $user->password !== null,
            'member_since' => $user->created_at?->toDateString(),
        ];
    }
}
