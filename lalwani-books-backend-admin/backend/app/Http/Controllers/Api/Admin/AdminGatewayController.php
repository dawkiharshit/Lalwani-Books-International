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
            // As saved, so a disconnected integration still shows its details.
            $saved = Cred::saved($key);

            $fields[$key] = [
                // Public identifiers can be shown; secrets only ever report state.
                'value' => $secret ? null : $saved,
                'is_secret' => $secret,
                'set' => $saved !== '',
                'source' => Cred::source($key),
            ];
        }

        return response()->json(['data' => [
            'group' => $group,
            'fields' => $fields,
            'disconnected' => Cred::isOff($group),
            // Emails go out after the page answers, so one that fails is listed
            // here for the admin rather than shown at the moment it happened.
            'problems' => $group === 'mail' ? \App\Support\MailLater::recentFailures() : [],
            'enabled' => match ($group) {
                'payment' => Razorpay::enabled(),
                'delivery' => Shiprocket::enabled(),
                'mail' => MailConfig::configured(),
                'google' => \App\Services\GoogleOAuth::enabled(),
                'whatsapp' => \App\Services\AiGrowBot::enabled(),
                'whatsapp_api' => \App\Services\AiGrowBot::apiEnabled(),
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
        // The shop will post order details here: a full https address only.
        if ($group === 'whatsapp') {
            $rules['aigrowbot_webhook_url'] = ['nullable', 'url:https', 'max:255'];
        }
        // AiGrowBot's "Tenant Subdomain" goes into its API addresses, so only
        // that one word: tidied of what copying from a web page brings along,
        // and pulled out of a pasted AiGrowBot address if need be.
        if ($group === 'whatsapp_api') {
            $request->merge(array_filter([
                'aigrowbot_tenant' => self::tenantName($request->input('aigrowbot_tenant')),
                // A token never has spaces; a copied one can carry invisible ones.
                'aigrowbot_api_token' => is_string($token = $request->input('aigrowbot_api_token'))
                    ? preg_replace(['/^[\s\p{Z}\p{Cf}]*Bearer\s+/iu', '/[\s\p{Z}\p{Cf}]+/u'], '', $token)
                    : null,
            ], fn ($value) => $value !== null));
            $rules['aigrowbot_tenant'] = ['nullable', 'string', function (string $attribute, mixed $value, \Closure $fail) {
                if (is_string($value) && ! preg_match(\App\Services\AiGrowBot::ACCOUNT_PATTERN, $value)) {
                    $fail(self::tenantProblem($value));
                }
            }];
            $rules['aigrowbot_api_token'] = ['nullable', 'string', 'max:500'];
        }
        $data = $request->validate($rules, [
            'aigrowbot_webhook_url.url' => 'The webhook URL must be a full https:// address.',
        ]);

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

    /**
     * Stop using an integration without losing its details: everything that
     * reads them sees it as not set up, until "Connect again".
     */
    public function disconnect(string $group)
    {
        abort_if(Cred::group($group) === [], 404, 'Unknown integration.');

        Cred::setOff($group, true);

        // A cached Shiprocket login would otherwise outlive the disconnect.
        if ($group === 'delivery') {
            Cache::forget('shiprocket_token');
        }

        return $this->index($group);
    }

    /** Use an integration's saved details again. */
    public function connect(string $group)
    {
        abort_if(Cred::group($group) === [], 404, 'Unknown integration.');

        Cred::setOff($group, false);

        return $this->index($group);
    }

    /** Live check against the provider, so the admin knows the details work. */
    public function test(Request $request, string $group)
    {
        if (Cred::group($group) !== [] && Cred::isOff($group)) {
            return response()->json(['message' => 'This is disconnected — press “Connect again” first.'], 422);
        }

        return match ($group) {
            'payment' => $this->testRazorpay(),
            'delivery' => $this->testShiprocket(),
            'mail' => $this->testMail($request),
            'google' => $this->testGoogle(),
            'whatsapp' => $this->testAiGrowBot(),
            'whatsapp_api' => $this->testAiGrowTemplates(),
            default => abort(404, 'Unknown integration.'),
        };
    }

    /**
     * Reads the account's WhatsApp templates: proves the Tenant Subdomain and
     * token work, and fills the template lists below. Sends nothing.
     */
    private function testAiGrowTemplates()
    {
        if (! \App\Services\AiGrowBot::apiEnabled()) {
            return response()->json(['message' => 'Enter your AiGrowBot Tenant Subdomain and API Token, then save.'], 422);
        }

        try {
            $templates = \App\Support\WhatsAppFlow::refreshTemplates();
        } catch (Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $total = $templates['total'];
        $ready = count(array_filter($templates['items'], fn ($t) => $t['blocked'] === null));

        return response()->json(['message' => $total === 0
            ? 'Connected, but this AiGrowBot account has no WhatsApp templates yet. Create them in AiGrowBot, then load them again.'
            : "Connected — found {$total} template".($total === 1 ? '' : 's')." ({$ready} approved). Choose them under Order messages below."]);
    }

    /**
     * The Tenant Subdomain as AiGrowBot → API Management shows it ("lalwani"),
     * from whatever was pasted: the word itself — with the invisible spaces
     * and quotes that copying from a web page can add — or an address that
     * holds it, like the "Example Endpoint" …/api/v1/lalwani/templates,
     * https://app.aigrowbot.com/lalwani/dashboard or https://lalwani.aigrowbot.com.
     */
    private static function tenantName(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        // Zero-width and other invisible characters anywhere; any kind of space
        // (a copied non-breaking one too) and wrapping quotes at either end.
        $value = preg_replace('/\p{Cf}+/u', '', $value) ?? '';
        $value = preg_replace('/^[\s\p{Z}"\'`“”‘’]+|[\s\p{Z}"\'`“”‘’]+$/u', '', $value) ?? '';

        // An API address on any host: the word after /api/v1/.
        if (preg_match('~/api/v\d+/([^/?#\s]+)~i', $value, $m)) {
            return $m[1];
        }

        if (! preg_match('~^(https?://)?([a-z0-9-]+\.)*aigrowbot\.[a-z.]+(/|$)~i', $value)) {
            return $value;
        }

        $url = preg_match('~^https?://~i', $value) ? $value : 'https://'.$value;
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));
        $sub = preg_replace('/\.?aigrowbot\.[a-z.]+$/', '', $host);
        if ($sub !== '' && ! in_array($sub, ['app', 'www'], true)) {
            return $sub;
        }

        $path = array_values(array_filter(explode('/', (string) parse_url($url, PHP_URL_PATH))));

        return $path[0] ?? '';
    }

    /** Why a pasted value is not a Tenant Subdomain, showing what arrived. */
    private static function tenantProblem(string $value): string
    {
        $shown = '“'.mb_strimwidth($value, 0, 60, '…').'”';
        $where = 'Copy the Tenant Subdomain from AiGrowBot → Settings → API Management (press the Copy button next to it)';

        return match (true) {
            str_contains($value, '@') => "{$shown} looks like an email address. {$where}.",
            (bool) preg_match('/\s/u', $value) => "{$shown} has spaces, but the Tenant Subdomain is a single word. {$where}.",
            default => "{$shown} is not a Tenant Subdomain — it has only letters, numbers and dashes. {$where}.",
        };
    }

    /**
     * Sends AiGrowBot a "test" event with a made-up order, so the admin can see
     * the connection work (and build the bot flow against a real payload).
     */
    private function testAiGrowBot()
    {
        if (! \App\Services\AiGrowBot::enabled()) {
            return response()->json(['message' => 'Enter the webhook URL, API username and secret key, then save.'], 422);
        }

        try {
            \App\Services\AiGrowBot::send('test', \App\Services\AiGrowBot::sampleOrder());
        } catch (Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(['message' => 'AiGrowBot accepted the test event.']);
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
