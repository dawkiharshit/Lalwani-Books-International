<?php

namespace App\Support;

use App\Models\Setting;
use App\Services\AiGrowBot;
use Illuminate\Support\Carbon;
use RuntimeException;
use Throwable;

/**
 * Which of the shop's own WhatsApp templates goes out at each step of an
 * order (admin → WhatsApp → Order messages), and what fills its blanks.
 *
 * The account's templates are read from AiGrowBot when the admin asks and
 * kept here, so the screen opens without calling AiGrowBot each time. It all
 * lives in settings rather than new tables: the live database only changes
 * through the admin panel (see GiftIdeas).
 */
final class WhatsAppFlow
{
    /** The order steps, as the admin screen names them, and the event each answers. */
    public const STEPS = [
        'placed' => 'order.placed',
        'shipped' => 'order.shipped',
        'delivered' => 'order.delivered',
        'cancelled' => 'order.cancelled',
    ];

    /** What a template's blanks can be filled with. */
    public const FIELDS = [
        'customer_name' => 'Customer name',
        'first_name' => 'Customer first name',
        'order_number' => 'Order number',
        'total' => 'Order total',
        'items' => 'Books ordered',
        'item_count' => 'Number of books',
        'payment' => 'Payment',
        'status' => 'Order status',
        'courier' => 'Courier',
        'tracking_url' => 'Tracking link',
        'order_url' => 'Order page link',
        'order_date' => 'Order date',
        'shop_name' => 'Shop name',
        'shop_phone' => 'Shop phone number',
    ];

    /** Headings that carry a file rather than words. */
    private const MEDIA_HEADERS = ['IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'];

    private const TEMPLATES_KEY = 'whatsapp_templates';

    private const FLOW_KEY = 'whatsapp_flow';

    private const LOG_KEY = 'whatsapp_log';

    /** The settings column holds 64 KB; the kept templates stay well inside it. */
    private const MAX_BYTES = 60000;

    /** The account's templates as last read from AiGrowBot. */
    public static function templates(): array
    {
        $saved = json_decode((string) Setting::get(self::TEMPLATES_KEY, ''), true);
        $items = is_array($saved) && is_array($saved['items'] ?? null) ? array_values($saved['items']) : [];

        return [
            'fetched_at' => is_array($saved) && is_string($saved['fetched_at'] ?? null) ? $saved['fetched_at'] : null,
            'items' => $items,
            // More than were kept, when an account has a great many.
            'total' => is_array($saved) ? max(count($items), (int) ($saved['total'] ?? 0)) : 0,
        ];
    }

    /** Read the templates from AiGrowBot again and keep them. Sends nothing. */
    public static function refreshTemplates(): array
    {
        $items = [];
        foreach (AiGrowBot::fetchTemplates() as $raw) {
            if ($template = self::normalize($raw)) {
                $items[] = $template;
            }
        }
        $total = count($items);

        // Ready-to-use ones first, then by name — so if the list has to be cut
        // to fit, it is the blocked ones that go.
        usort($items, fn ($a, $b) => [$a['blocked'] !== null, $a['name'], $a['language']]
            <=> [$b['blocked'] !== null, $b['name'], $b['language']]);

        do {
            $json = json_encode(
                ['fetched_at' => now()->toIso8601String(), 'total' => $total, 'items' => $items],
                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
            );
        } while (strlen($json) > self::MAX_BYTES && array_pop($items) !== null);

        Setting::set(self::TEMPLATES_KEY, $json);

        return self::templates();
    }

    /** One kept template by name and language, if the account has it. */
    public static function find(string $name, string $language): ?array
    {
        foreach (self::templates()['items'] as $template) {
            if (($template['name'] ?? null) === $name && ($template['language'] ?? null) === $language) {
                return $template;
            }
        }

        return null;
    }

    /**
     * One template in the shape the admin screen uses, from however AiGrowBot
     * describes it — its own columns, or WhatsApp's "components".
     */
    public static function normalize(array $raw): ?array
    {
        $name = self::line($raw['template_name'] ?? $raw['name'] ?? '', 512);
        if ($name === '') {
            return null;
        }

        $parts = self::components($raw['components'] ?? null);

        $headerFormat = strtoupper(self::line($raw['header_data_format'] ?? $raw['header_format'] ?? $parts['HEADER']['format'] ?? '', 20));
        $header = self::text($raw['header_data_text'] ?? $raw['header_text'] ?? $parts['HEADER']['text'] ?? '', 120);
        $body = self::text($raw['body_data'] ?? $raw['body_text'] ?? $raw['body'] ?? $parts['BODY']['text'] ?? '', 1024);
        $footer = self::text($raw['footer_data'] ?? $raw['footer_text'] ?? $raw['footer'] ?? $parts['FOOTER']['text'] ?? '', 120);
        $buttons = self::buttons($raw['buttons_data'] ?? $raw['buttons'] ?? $parts['BUTTONS']['buttons'] ?? []);

        // The blanks in its words, padded out when AiGrowBot counts more.
        $vars = self::vars($body);
        for ($n = count($vars) + 1; $n <= min((int) ($raw['body_params_count'] ?? 0), 20); $n++) {
            $vars[] = (string) $n;
        }

        $headerBlanks = max((int) ($raw['header_params_count'] ?? 0), count(self::vars($header)));
        $buttonBlanks = count(array_filter($buttons, fn ($b) => str_contains($b['url'], '{{')));
        $status = strtoupper(self::line($raw['status'] ?? '', 30));

        return [
            'name' => $name,
            'language' => self::line($raw['language'] ?? $raw['template_language'] ?? $raw['lang'] ?? '', 20) ?: 'en',
            'status' => $status,
            'category' => strtoupper(self::line($raw['category'] ?? '', 30)),
            'header_format' => $headerFormat,
            'header' => $header,
            'body' => $body,
            'footer' => $footer,
            'buttons' => $buttons,
            'vars' => $vars,
            // Why it can't be sent at all, if so.
            'blocked' => match ($status) {
                '', 'APPROVED' => null,
                'PENDING', 'IN_APPEAL' => 'WhatsApp has not approved it yet.',
                'REJECTED' => 'WhatsApp rejected it.',
                'PAUSED' => 'WhatsApp has paused it.',
                'DISABLED' => 'WhatsApp has disabled it.',
                default => 'It is not approved ('.mb_strtolower($status).').',
            },
            // Parts the shop cannot fill: AiGrowBot's API takes words for the
            // blanks in the message itself, and nothing else.
            'warning' => match (true) {
                in_array($headerFormat, self::MEDIA_HEADERS, true) => 'It starts with a picture, video or document, which AiGrowBot may not add by itself. Send yourself a test before switching it on.',
                $headerBlanks > 0 => 'Its heading has a blank, which AiGrowBot may not fill. Send yourself a test before switching it on.',
                $buttonBlanks > 0 => 'Its link button has a blank, which AiGrowBot may not fill. Send yourself a test before switching it on.',
                default => null,
            },
        ];
    }

    /** The saved choice for every step: on or off, which template, and what fills each blank. */
    public static function flow(): array
    {
        $saved = json_decode((string) Setting::get(self::FLOW_KEY, ''), true);
        $saved = is_array($saved) ? $saved : [];

        $out = [];
        foreach (array_keys(self::STEPS) as $step) {
            $entry = is_array($saved[$step] ?? null) ? $saved[$step] : [];
            $out[$step] = [
                'on' => (bool) ($entry['on'] ?? false),
                'template' => is_string($entry['template'] ?? null) ? $entry['template'] : '',
                'language' => is_string($entry['language'] ?? null) ? $entry['language'] : '',
                'fields' => array_values(array_filter(
                    is_array($entry['fields'] ?? null) ? $entry['fields'] : [],
                    fn ($field) => is_string($field) && isset(self::FIELDS[$field])
                )),
            ];
        }

        return $out;
    }

    public static function saveFlow(array $flow): void
    {
        Setting::set(self::FLOW_KEY, json_encode($flow, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    /** The template switched on for an event such as "order.shipped", if any. */
    public static function forEvent(string $event): ?array
    {
        $step = array_search($event, self::STEPS, true);
        if ($step === false) {
            return null;
        }

        $entry = self::flow()[$step];

        return $entry['on'] && $entry['template'] !== '' ? $entry + ['step' => $step] : null;
    }

    /**
     * What each blank is filled with for one order (in AiGrowBot::orderData's
     * shape). Every value is a single line and never empty: WhatsApp refuses a
     * blank with a line break, a tab, a run of spaces, or nothing in it.
     *
     * @return array<string, string>
     */
    public static function values(array $order): array
    {
        $name = self::line($order['customer_name'] ?? '', 120);
        $items = array_values(array_filter(
            is_array($order['items'] ?? null) ? $order['items'] : [],
            fn ($item) => is_array($item) && self::line($item['name'] ?? '', 200) !== ''
        ));
        $titles = array_map(
            fn ($item) => self::line($item['name'], 80).((int) ($item['quantity'] ?? 1) > 1 ? ' × '.(int) $item['quantity'] : ''),
            array_slice($items, 0, 3)
        );
        $more = count($items) - count($titles);
        $orderUrl = self::line($order['order_url'] ?? '', 300);
        $placed = rescue(fn () => Carbon::parse((string) ($order['placed_at'] ?? '')), null, false);

        $values = [
            'customer_name' => $name ?: 'Customer',
            'first_name' => $name !== '' ? explode(' ', $name)[0] : 'Customer',
            'order_number' => self::line($order['order_number'] ?? '', 40),
            'total' => Money::format((float) ($order['total'] ?? 0)),
            'items' => implode(', ', $titles).($more > 0 ? " and {$more} more" : ''),
            'item_count' => (string) array_sum(array_map(fn ($item) => max(1, (int) ($item['quantity'] ?? 1)), $items)),
            'payment' => match (true) {
                ($order['payment_method'] ?? '') === 'cod' => 'Cash on delivery',
                ($order['payment_status'] ?? '') === 'paid' => 'Paid online',
                default => 'Online payment',
            },
            'status' => ucfirst(self::line($order['status'] ?? '', 30)),
            'courier' => self::line($order['courier'] ?? '', 80) ?: 'our courier partner',
            'tracking_url' => self::line($order['tracking_url'] ?? '', 300) ?: $orderUrl,
            'order_url' => $orderUrl,
            'order_date' => ($placed ?? now())->timezone('Asia/Kolkata')->format('j M Y'),
            'shop_name' => self::line(Setting::get('site_name', ''), 80) ?: 'Lalwani Books International',
            'shop_phone' => self::line(Setting::get('support_phone', ''), 30),
        ];

        return array_map(fn (string $value) => $value !== '' ? $value : '-', $values);
    }

    /** The values for a template's blanks, in order. */
    public static function fill(array $fields, array $order): array
    {
        $values = self::values($order);

        return array_map(fn ($field) => $values[$field] ?? '-', array_values($fields));
    }

    /**
     * Send an order step's template to the customer, and note how it went for
     * the admin screen. Throws when it could not be sent.
     */
    public static function deliver(string $event, array $entry, array $order): void
    {
        $step = (string) ($entry['step'] ?? array_search($event, self::STEPS, true));
        $number = (string) ($order['order_number'] ?? '');
        $phone = AiGrowBot::phone($order['phone'] ?? null);

        try {
            if (! $phone || ! preg_match('/^\d{11,15}$/', $phone)) {
                throw new RuntimeException('The order has no WhatsApp number to send to.');
            }

            AiGrowBot::sendTemplate(
                $entry['template'],
                $entry['language'],
                $phone,
                self::fill($entry['fields'], $order),
                $order['customer_name'] ?? null
            );
        } catch (Throwable $e) {
            self::note($step, $number, false, $e->getMessage());

            throw $e;
        }

        self::note($step, $number, true, 'Sent “'.$entry['template'].'”.');
    }

    /** The latest WhatsApp messages and how they went, newest first. */
    public static function recent(): array
    {
        $log = json_decode((string) Setting::get(self::LOG_KEY, '[]'), true);

        return is_array($log) ? array_values(array_filter($log, 'is_array')) : [];
    }

    /** Keep a line about one message for the admin screen; the last 15 are kept. */
    public static function note(string $step, string $order, bool $ok, string $note, bool $test = false): void
    {
        $entry = [
            'at' => now()->toIso8601String(),
            'step' => $step,
            'order' => mb_substr($order, 0, 40),
            'ok' => $ok,
            'note' => mb_strimwidth($note, 0, 240, '…'),
            'test' => $test,
        ];

        try {
            Setting::set(self::LOG_KEY, json_encode(
                array_slice([$entry, ...self::recent()], 0, 15),
                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
            ));
        } catch (Throwable) {
            // Only a convenience for the admin screen — never worth failing a send over.
        }
    }

    /** WhatsApp's own description of a template, by part. */
    private static function components(mixed $value): array
    {
        if (is_string($value)) {
            $value = json_decode($value, true);
        }

        $out = [];
        foreach (is_array($value) ? $value : [] as $part) {
            if (is_array($part) && is_string($part['type'] ?? null)) {
                $out[strtoupper($part['type'])] ??= $part;
            }
        }

        return $out;
    }

    /** @return array<int, array{type: string, text: string, url: string}> */
    private static function buttons(mixed $value): array
    {
        if (is_string($value)) {
            $value = json_decode($value, true);
        }
        if (! is_array($value)) {
            return [];
        }
        // WhatsApp's BUTTONS part, or the list itself.
        $value = is_array($value['buttons'] ?? null) ? $value['buttons'] : $value;

        $out = [];
        foreach (array_slice(array_values(array_filter($value, 'is_array')), 0, 10) as $button) {
            $out[] = [
                'type' => strtoupper(self::line($button['type'] ?? '', 30)),
                'text' => self::line($button['text'] ?? '', 40),
                'url' => self::line($button['url'] ?? '', 300),
            ];
        }

        return $out;
    }

    /**
     * A template's blanks in order: numbered ones by number ({{1}} first,
     * whatever order the words use them in), named ones as they appear.
     *
     * @return array<int, string>
     */
    private static function vars(string $text): array
    {
        preg_match_all('/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/', $text, $m);
        $found = array_values(array_unique($m[1]));

        if ($found !== [] && count(array_filter($found, 'ctype_digit')) === count($found)) {
            return array_map('strval', range(1, max(1, min(20, max(array_map('intval', $found))))));
        }

        return array_slice($found, 0, 20);
    }

    /** Words from AiGrowBot, kept as written (line breaks too), only so long. */
    private static function text(mixed $value, int $max): string
    {
        return is_string($value) || is_numeric($value) ? mb_substr(trim((string) $value), 0, $max) : '';
    }

    /** One line of text, no longer than $max. */
    private static function line(mixed $value, int $max): string
    {
        return is_string($value) || is_numeric($value)
            ? mb_substr(trim(preg_replace('/\s+/u', ' ', (string) $value) ?? ''), 0, $max)
            : '';
    }
}
