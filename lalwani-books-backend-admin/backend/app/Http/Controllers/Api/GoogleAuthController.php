<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\GoogleOAuth;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Throwable;

/**
 * "Sign in with Google" for the Next.js storefront.
 *
 * The browser is redirected to Google and comes back here. Rather than putting
 * the API token in the redirect URL — where it would sit in browser history,
 * server logs and any Referer header — the token is parked behind a one-time
 * handle that the frontend trades in over POST.
 */
class GoogleAuthController extends Controller
{
    private const STATE_TTL = 600;      // 10 minutes to finish at Google
    private const HANDOFF_TTL = 120;    // 2 minutes to collect the token

    public function status()
    {
        return response()->json(['data' => ['enabled' => GoogleOAuth::enabled()]]);
    }

    /** Step 1 — send the browser to Google. */
    public function redirect()
    {
        if (! GoogleOAuth::enabled()) {
            return $this->bounce('google_not_configured');
        }

        $state = Str::random(40);
        Cache::put('google_state:'.$state, true, self::STATE_TTL);

        return redirect()->away(GoogleOAuth::authUrl($state));
    }

    /** Step 2 — Google sends the browser back with a code. */
    public function callback(Request $request)
    {
        if ($request->query('error')) {
            return $this->bounce('cancelled');
        }

        $state = (string) $request->query('state');
        $code = (string) $request->query('code');

        // The state proves this callback belongs to a redirect we started.
        if ($state === '' || ! Cache::pull('google_state:'.$state)) {
            return $this->bounce('bad_state');
        }

        if ($code === '') {
            return $this->bounce('no_code');
        }

        try {
            $profile = GoogleOAuth::profileFromCode($code);
        } catch (Throwable $e) {
            report($e);

            return $this->bounce('exchange_failed');
        }

        $user = $this->findOrCreate($profile);

        // One-time handle; the real token never touches the URL.
        $handoff = Str::random(48);
        Cache::put(
            'google_handoff:'.$handoff,
            $user->createToken('lalwani-spa')->plainTextToken,
            self::HANDOFF_TTL
        );

        return redirect()->away($this->frontend().'/auth/google?handoff='.$handoff);
    }

    /** Step 3 — the frontend trades the handle for the token, once. */
    public function exchange(Request $request)
    {
        $data = $request->validate([
            'handoff' => ['required', 'string', 'max:64'],
        ]);

        $token = Cache::pull('google_handoff:'.$data['handoff']);

        if (! $token) {
            return response()->json(['message' => 'This sign-in link has already been used.'], 422);
        }

        $user = \Laravel\Sanctum\PersonalAccessToken::findToken($token)?->tokenable;

        if (! $user) {
            return response()->json(['message' => 'Sign-in expired. Please try again.'], 422);
        }

        return response()->json([
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'is_admin' => (bool) $user->is_admin,
                'email_verified' => (bool) $user->email_verified_at,
                'avatar' => $user->avatar,
                'has_password' => $user->password !== null,
            ],
        ]);
    }

    /**
     * Match on google_id first, then on the email so someone who registered
     * with a password can also sign in with Google and keep one account.
     */
    private function findOrCreate(array $profile): User
    {
        $user = User::where('google_id', $profile['sub'])->first()
            ?? User::where('email', $profile['email'])->first();

        if (! $user) {
            $user = new User;
            $user->name = $profile['name'];
            $user->email = $profile['email'];
        }

        $user->forceFill([
            'google_id' => $profile['sub'],
            'avatar' => $profile['picture'] ?: $user->avatar,
            // Google already proved the address — no code needed.
            'email_verified_at' => $user->email_verified_at
                ?? ($profile['email_verified'] ? now() : null),
        ])->save();

        return $user;
    }

    private function frontend(): string
    {
        return (config('app.frontend_url') ?: rtrim((string) config('app.url'), '/'));
    }

    /** Hand the browser back to the login page with a reason it can explain. */
    private function bounce(string $reason)
    {
        return redirect()->away($this->frontend().'/login?google_error='.$reason);
    }
}
