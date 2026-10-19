<?php

namespace App\Services;

use App\Models\Order;
use App\Support\GatewayCredentials as Cred;
use App\Support\WhatsAppFlow;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

/**
 * WhatsApp messages through AiGrowBot, set up in admin → WhatsApp. Two ways:
 *
 * 1. Templates. With the Tenant Subdomain and API Token from AiGrowBot → API
 *    Management, the shop reads the account's own WhatsApp templates and, at
 *    each order step the admin has switched on, sends the chosen template
 *    itself — its blanks filled from the order — through AiGrowBot's API
 *    (POST /api/v1/{account}/messages/template). See WhatsAppFlow.
 *
 * 2. Webhook. The shop posts what happened to a webhook URL, and a bot flow
 *    set up in AiGrowBot turns that into the WhatsApp message. Each post is
 *    JSON:
 *
 *      { "event": "order.shipped", "sent_at": "…", "data": { order details } }
 *
 *    signed in with the API username and secret key (HTTP Basic, plus an
 *    X-Api-Username header), and stamped with X-Signature: sha256=<HMAC of
 *    the body with the secret key>, so AiGrowBot can tell it really came from
 *    this shop.
 *
 * A step with a template switched on goes out as that template only, so a
 * customer never gets the same news twice. Secrets are stored encrypted and
 * never shown again.
 */
class AiGrowBot
{
    /** Events the website sends, besides "test" from the admin's button. */
    public const EVENTS = ['order.placed', 'order.shipped', 'order.delivered', 'order.cancelled'];

    /** An AiGrowBot "Tenant Subdomain", as it appears in its API addresses. */
    public const ACCOUNT_PATTERN = '/^[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/';

    /** Where AiGrowBot's API lives (config services.aigrowbot.url overrides it). */
    private const API_BASE = 'https://app.aigrowbot.com';

    public static function enabled(): bool
    {
        return Cred::has('aigrowbot_webhook_url')
            && Cred::has('aigrowbot_api_username')
            && Cred::has('aigrowbot_secret_key');
    }

    /** Can the shop send the account's own templates (Tenant Subdomain and API Token saved)? */
    public static function apiEnabled(): bool
    {
        return Cred::has('aigrowbot_tenant') && Cred::has('aigrowbot_api_token');
    }

    /**
     * Post one event now. Throws with a reason the admin can act on when
     * AiGrowBot refuses it or cannot be reached.
     */
    public static function send(string $event, array $data): void
    {
        $url = Cred::get('aigrowbot_webhook_url');
        $username = Cred::get('aigrowbot_api_username');
        $secret = Cred::get('aigrowbot_secret_key');

        self::assertSafeUrl($url);

        $body = json_encode(
            ['event' => $event, 'sent_at' => now()->toIso8601String(), 'data' => $data],
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
        );

        try {
            $res = Http::withBasicAuth($username, $secret)
                ->withHeaders([
                    'X-Api-Username' => $username,
                    'X-Event' => $event,
                    'X-Signature' => 'sha256='.hash_hmac('sha256', $body, $secret),
                ])
                ->acceptJson()
                ->timeout(8)
                ->withBody($body, 'application/json')
                ->post($url);
        } catch (Throwable $e) {
            throw new RuntimeException('Could not reach AiGrowBot at that webhook URL. Check the address and try again.');
        }

        if (! $res->successful()) {
            $said = $res->json('message') ?? $res->json('error');
            $said = is_string($said) && $said !== '' ? ' ("'.mb_strimwidth($said, 0, 140, '…').'")' : '';

            throw new RuntimeException(match (true) {
                in_array($res->status(), [401, 403], true) => "AiGrowBot refused the API username or secret key{$said}.",
                $res->status() === 404 => "AiGrowBot does not know that webhook URL{$said}. Copy it again from AiGrowBot.",
                default => "AiGrowBot answered with an error ({$res->status()}){$said}.",
            });
        }
    }

    /**
     * Every WhatsApp template in the AiGrowBot account, as AiGrowBot lists
     * them. Read-only: nothing is sent to anyone.
     *
     * @return array<int, array<string, mixed>>
     */
    public static function fetchTemplates(): array
    {
        $items = [];

        // Further pages are asked for by number — never by a URL taken from the
        // answer — and only so far: a list longer than that is not templates.
        for ($page = 1; $page <= 10; $page++) {
            $res = self::call(fn (PendingRequest $http) => $http->get(
                self::apiUrl('templates'),
                $page > 1 ? ['page' => $page] : []
            ));

            [$list, $last] = self::templateList($res->json());
            array_push($items, ...$list);

            if ($page >= $last || $list === []) {
                break;
            }
        }

        return $items;
    }

    /**
     * Send one template to one WhatsApp number, its blanks filled in order
     * ({{1}} first). Throws with a reason the admin can act on.
     *
     * @param  array<int, string>  $values
     */
    public static function sendTemplate(string $template, string $language, string $phone, array $values, ?string $name = null): void
    {
        $body = [
            'phone_number' => '+'.$phone,
            'template_name' => $template,
            'template_language' => $language,
        ];

        foreach (array_values($values) as $i => $value) {
            $body['field_'.($i + 1)] = $value;
        }

        // Saved as a contact in AiGrowBot when the number is new, so the reply
        // shows up there under the customer's name.
        $name = trim((string) $name);
        if ($name !== '') {
            [$first, $last] = array_pad(preg_split('/\s+/', $name, 2) ?: [], 2, '');
            $body['contact'] = array_filter(['firstname' => $first, 'lastname' => $last]);
        }

        self::call(fn (PendingRequest $http) => $http->post(self::apiUrl('messages/template'), $body));
    }

    /**
     * For the website's flows: queued to run after the shopper (or admin) has
     * their response, and never allowed to break the action that caused it.
     */
    public static function notify(string $event, array $data): void
    {
        $template = self::apiEnabled() ? WhatsAppFlow::forEvent($event) : null;

        if (! $template && ! self::enabled()) {
            return;
        }

        // One message per order per step, even when the step is announced
        // twice — an online payment is confirmed by both the shopper's browser
        // and Razorpay's webhook, sometimes at the same moment.
        if (! Cache::add('aigrowbot:'.$event.':'.($data['order_number'] ?? ''), true, now()->addDays(2))) {
            return;
        }

        defer(function () use ($event, $data, $template) {
            try {
                $template ? WhatsAppFlow::deliver($event, $template, $data) : self::send($event, $data);
            } catch (Throwable $e) {
                Log::warning('AiGrowBot event not delivered', ['event' => $event, 'error' => $e->getMessage()]);
            }
        });
    }

    /** What AiGrowBot gets about an order: enough to write the message, nothing more. */
    public static function orderData(Order $order): array
    {
        $order->loadMissing('items');

        return [
            'order_number' => $order->order_number,
            'status' => $order->status,
            'customer_name' => $order->ship_name,
            'phone' => self::phone($order->ship_phone),
            'email' => $order->email,
            'total' => round((float) $order->total, 2),
            'currency' => 'INR',
            'payment_method' => $order->payment_method,
            'payment_status' => $order->payment_status,
            'items' => $order->items
                ->map(fn ($i) => ['name' => $i->name, 'quantity' => (int) $i->quantity])
                ->values()
                ->all(),
            'courier' => $order->courier_name,
            'tracking_url' => $order->tracking_url,
            'order_url' => rtrim((string) config('app.frontend_url'), '/').'/account/orders/'.$order->order_number,
            'placed_at' => optional($order->placed_at)->toIso8601String(),
        ];
    }

    /** A made-up order in the same shape, for the admin's "Send test event". */
    public static function sampleOrder(): array
    {
        return [
            'order_number' => 'LBI-TEST-0001',
            'status' => 'processing',
            'customer_name' => 'Test Customer',
            'phone' => '919999999999',
            'email' => 'test@example.com',
            'total' => 499.0,
            'currency' => 'INR',
            'payment_method' => 'cod',
            'payment_status' => 'pending',
            'items' => [['name' => 'Sample Book', 'quantity' => 1]],
            'courier' => null,
            'tracking_url' => null,
            'order_url' => rtrim((string) config('app.frontend_url'), '/').'/account',
            'placed_at' => now()->toIso8601String(),
        ];
    }

    /** An Indian mobile number as WhatsApp wants it: 91 followed by 10 digits. */
    public static function phone(?string $raw): ?string
    {
        $digits = preg_replace('/\D/', '', (string) $raw) ?? '';

        return match (true) {
            strlen($digits) === 10 => '91'.$digits,
            strlen($digits) === 11 && str_starts_with($digits, '0') => '91'.substr($digits, 1),
            $digits === '' => null,
            default => $digits,
        };
    }

    /** The API address for one resource of the saved account. */
    private static function apiUrl(string $path): string
    {
        $account = Cred::get('aigrowbot_tenant');

        if (! preg_match(self::ACCOUNT_PATTERN, $account)) {
            throw new RuntimeException('Enter your AiGrowBot Tenant Subdomain in admin → WhatsApp.');
        }

        $base = rtrim((string) (config('services.aigrowbot.url') ?: self::API_BASE), '/');
        self::assertSafeUrl($base);

        return $base.'/api/v1/'.rawurlencode($account).'/'.$path;
    }

    /** One call with the API token, AiGrowBot's refusal turned into words. */
    private static function call(callable $request): Response
    {
        $http = Http::withToken(Cred::get('aigrowbot_api_token'))
            ->acceptJson()
            ->asJson()
            ->connectTimeout(6)
            ->timeout(15);

        try {
            $res = $request($http);
        } catch (ConnectionException) {
            throw new RuntimeException('Could not reach AiGrowBot. Check the internet connection and try again.');
        }

        $json = $res->json();
        $refused = is_array($json) && (($json['success'] ?? null) === false || ($json['status'] ?? null) === 'error');

        if ($res->successful() && ! $refused) {
            return $res;
        }

        $said = self::said($json);
        $quoted = $said !== '' ? ' ("'.$said.'")' : '';

        throw new RuntimeException(match (true) {
            in_array($res->status(), [401, 403], true) => "AiGrowBot refused the API token{$quoted}. In AiGrowBot → Settings → API Management, check that Enable API Access is on, then copy the API Token again (or press Generate New Token) and paste it here.",
            str_contains(strtolower($said), 'tenant') => "AiGrowBot does not know that Tenant Subdomain{$quoted}. Copy it again from AiGrowBot → Settings → API Management.",
            $res->status() === 429 => 'AiGrowBot is busy (too many requests). Wait a minute and try again.',
            default => "AiGrowBot answered with an error ({$res->status()}){$quoted}.",
        });
    }

    /** AiGrowBot's own explanation, from whichever fields it used. */
    private static function said(mixed $json): string
    {
        if (! is_array($json)) {
            return '';
        }

        $parts = [];
        foreach (['message', 'error', 'errors'] as $key) {
            foreach (Arr::wrap($json[$key] ?? []) as $part) {
                foreach (is_array($part) ? Arr::flatten($part) : [$part] as $text) {
                    if (is_string($text) && trim($text) !== '') {
                        $parts[] = trim($text);
                    }
                }
            }
        }

        return mb_strimwidth(implode(' — ', array_unique($parts)), 0, 200, '…');
    }

    /**
     * The templates out of an answer, whichever shape it takes — a bare list,
     * { data: [...] } or a page { data: { data: [...], last_page } } — and
     * how many pages there are.
     *
     * @return array{0: array<int, array<string, mixed>>, 1: int}
     */
    private static function templateList(mixed $json): array
    {
        if (is_array($json) && array_is_list($json)) {
            return [array_values(array_filter($json, 'is_array')), 1];
        }

        $data = is_array($json) ? ($json['data'] ?? $json['templates'] ?? null) : null;
        $last = (int) ($json['meta']['last_page'] ?? $json['last_page'] ?? 1);

        if (is_array($data) && ! array_is_list($data)) {
            $last = (int) ($data['last_page'] ?? $data['meta']['last_page'] ?? $last);
            $data = $data['data'] ?? $data['templates'] ?? null;
        }

        if (! is_array($data) || ! array_is_list($data)) {
            throw new RuntimeException('AiGrowBot answered, but not with a list of templates.');
        }

        return [array_values(array_filter($data, 'is_array')), max(1, $last)];
    }

    /**
     * Only a public https address: this server posts customer details there,
     * so it must never be pointed at itself or a machine on its own network.
     */
    private static function assertSafeUrl(string $url): void
    {
        $parts = parse_url($url);
        $host = strtolower((string) ($parts['host'] ?? ''));

        if (($parts['scheme'] ?? '') !== 'https' || $host === '') {
            throw new RuntimeException('The webhook URL must be a full https:// address.');
        }

        $ip = trim($host, '[]');
        $private = filter_var($ip, FILTER_VALIDATE_IP)
            && ! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE);

        if ($host === 'localhost' || str_ends_with($host, '.localhost') || $private) {
            throw new RuntimeException('The webhook URL must be a public address, not this server or a private network.');
        }
    }
}
