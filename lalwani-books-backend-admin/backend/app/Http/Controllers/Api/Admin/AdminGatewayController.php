<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\Razorpay;
use App\Services\Shiprocket;
use App\Support\GatewayCredentials as Cred;
use App\Support\MailConfig;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Credentials for the outbound integrations, edited from the admin panel.
 *
 * One group per screen — payment, delivery, mail — so each is saved and tested
 * on its own and a failure in one never blocks editing another.
 *
 * Secrets are write-only over the API: the response says whether a value is
 * set and where it came from, never what it is.
 */
class AdminGatewayController extends Controller
{
    public function index(string $group)
    {
        $keys = Cred::group($group);
        abort_if($keys === [], 404, 'Unknown integration.');

        $fields = [];

        foreach ($keys as $key) {
            $secret = in_array($key, Cred::SECRETS, true);

            $fields[$key] = [
                // Public identifiers can be shown; secrets only ever report state.
                'value' => $secret ? null : Cred::get($key),
                'is_secret' => $secret,
                'set' => Cred::has($key),
                'source' => Cred::source($key),
            ];
        }

        return response()->json(['data' => [
            'group' => $group,
            'fields' => $fields,
            'enabled' => match ($group) {
                'payment' => Razorpay::enabled(),
                'delivery' => Shiprocket::enabled(),
                'mail' => MailConfig::configured(),
                'google' => \App\Services\GoogleOAuth::enabled(),
            },
            // The payment screen shows a webhook URL, the Google screen the
            // redirect URI it must be registered with. A null keeps the shape.
            'webhook_url' => match ($group) {
                'payment' => url('/api/v1/payments/razorpay/webhook'),
                'google' => \App\Services\GoogleOAuth::redirectUri(),
                default => null,
            },
        ]]);
    }

    /**
     * Save one group. A field that is absent is left alone; listing a field in
     * `clear` wipes it.
     */
    public function update(Request $request, string $group)
    {
        $keys = Cred::group($group);
        abort_if($keys === [], 404, 'Unknown integration.');

        $rules = ['clear' => ['nullable', 'array']];
        foreach ($keys as $key) {
            $rules[$key] = ['nullable', 'string', 'max:255'];
        }
        $data = $request->validate($rules);

        $clear = collect($data['clear'] ?? [])->intersect($keys);

        foreach ($keys as $key) {
            if ($clear->contains($key)) {
                Cred::set($key, '');

                continue;
            }

            // Blank means "leave as is" — otherwise saving the form would wipe
            // every secret the admin cannot see to retype.
            $value = trim((string) ($data[$key] ?? ''));

            if ($value !== '') {
                Cred::set($key, $value);
            }
        }

        // A cached Shiprocket token was minted with the old password.
        if ($group === 'delivery') {
            Cache::forget('shiprocket_token');
        }

        // The mailer was built from the previous config earlier in this same
        // request, so rebuild it before anything tries to send.
        if ($group === 'mail') {
            MailConfig::apply();
            app()->forgetInstance('mailer');
            app()->forgetInstance('mail.manager');
        }

        return $this->index($group);
    }

    /** Live check against the provider, so the admin knows the details work. */
    public function test(Request $request, string $group)
    {
        return match ($group) {
            'payment' => $this->testRazorpay(),
            'delivery' => $this->testShiprocket(),
            'mail' => $this->testMail($request),
            'google' => $this->testGoogle(),
            default => abort(404, 'Unknown integration.'),
        };
    }

    /**
     * Google has no "verify these keys" endpoint — the credentials are only
     * judged during a real sign-in — so this reports readiness honestly rather
     * than pretending to have checked them.
     */
    private function testGoogle()
    {
        if (! \App\Services\GoogleOAuth::enabled()) {
            return response()->json(['message' => 'Enter the Client ID and Client Secret first.'], 422);
        }

        return response()->json([
            'message' => 'Both values are saved. Google only checks them during a real sign-in — '
                .'open the storefront login page and press "Continue with Google" to confirm.',
        ]);
    }

    private function testRazorpay()
    {
        if (! Razorpay::enabled()) {
            return response()->json(['message' => 'Enter the Key ID and Key Secret first.'], 422);
        }

        try {
            // Cheapest authenticated call there is — a bad key returns 401.
            $res = Http::withBasicAuth(Razorpay::keyId(), Cred::get('razorpay_key_secret'))
                ->acceptJson()->timeout(15)
                ->get('https://api.razorpay.com/v1/payments', ['count' => 1]);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Could not reach Razorpay: '.$e->getMessage()], 422);
        }

        return $res->successful()
            ? response()->json(['message' => 'Razorpay keys are working.'])
            : response()->json(['message' => 'Razorpay rejected these keys ('.$res->status().').'], 422);
    }

    private function testShiprocket()
    {
        if (! Shiprocket::enabled()) {
            return response()->json(['message' => 'Enter the Shiprocket API user email and password first.'], 422);
        }

        try {
            Shiprocket::token(fresh: true);
        } catch (Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(['message' => 'Shiprocket login succeeded.']);
    }

    /** Sends a real message to the signed-in admin — the only honest test. */
    private function testMail(Request $request)
    {
        if (! MailConfig::configured()) {
            return response()->json(['message' => 'Enter the SMTP host and From address first.'], 422);
        }

        // Defaults to the admin's own address, but a fresh install's admin
        // often sits on a placeholder domain with no real mailbox — the test
        // would then vanish and read as an SMTP failure. Let them name a
        // inbox they can actually open.
        $to = trim((string) $request->input('to')) ?: (string) $request->user()->email;

        $request->merge(['to' => $to]);
        $request->validate(['to' => ['required', 'email', 'max:190']]);

        try {
            MailConfig::apply();

            Mail::raw(
                "This is a test message from your ".config('app.name')." admin panel.\n\n"
                ."If you are reading it, order confirmations and password-reset links "
                ."will reach your customers.",
                fn ($m) => $m->to($to)->subject(config('app.name').' — SMTP test')
            );
        } catch (Throwable $e) {
            return response()->json(['message' => 'Could not send: '.$e->getMessage()], 422);
        }

        return response()->json(['message' => "Test email sent to {$to}. Check the inbox (and spam)."]);
    }
}
