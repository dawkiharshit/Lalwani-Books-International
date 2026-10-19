<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\AiGrowBot;
use App\Support\WhatsAppFlow;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Admin → WhatsApp → Order messages: one of the account's own AiGrowBot
 * templates for each step of an order, and what fills its blanks.
 *
 * Reading the templates sends nothing; the test sends one message, filled
 * with a made-up order, to the number the admin types.
 */
class AdminWhatsAppController extends Controller
{
    private const LABELS = [
        'placed' => 'Order placed',
        'shipped' => 'Order shipped',
        'delivered' => 'Order delivered',
        'cancelled' => 'Order cancelled',
    ];

    /** When each step goes out, as the screen explains it. */
    private const WHEN = [
        'placed' => 'Right after a cash-on-delivery order is placed, or once an online payment goes through.',
        'shipped' => 'When the order is marked Shipped — by you, or by Shiprocket when a courier is booked.',
        'delivered' => 'When the order is marked Delivered.',
        'cancelled' => 'When the order is cancelled, by you or by the customer.',
    ];

    /** What usually fills a step's blanks, in the order templates tend to use them. */
    private const SUGGEST = [
        'placed' => ['customer_name', 'order_number', 'total', 'items', 'order_url'],
        'shipped' => ['customer_name', 'order_number', 'courier', 'tracking_url'],
        'delivered' => ['customer_name', 'order_number', 'order_url'],
        'cancelled' => ['customer_name', 'order_number', 'total'],
    ];

    public function show()
    {
        return response()->json(['data' => $this->payload()]);
    }

    /** Read the account's templates from AiGrowBot again. Sends nothing. */
    public function refresh()
    {
        if (! AiGrowBot::apiEnabled()) {
            return response()->json(['message' => 'Save your AiGrowBot Tenant Subdomain and API Token first.'], 422);
        }

        try {
            WhatsAppFlow::refreshTemplates();
        } catch (Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(['data' => $this->payload()]);
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'steps' => ['required', 'array'],
            'steps.*' => ['array'],
            'steps.*.on' => ['boolean'],
            'steps.*.template' => ['nullable', 'string', 'max:512'],
            'steps.*.language' => ['nullable', 'string', 'max:20'],
            'steps.*.fields' => ['nullable', 'array', 'max:20'],
            'steps.*.fields.*' => ['string', Rule::in(array_keys(WhatsAppFlow::FIELDS))],
        ]);

        $flow = WhatsAppFlow::flow();
        $errors = [];

        foreach (array_keys(WhatsAppFlow::STEPS) as $step) {
            if (! isset($data['steps'][$step])) {
                continue;
            }

            $in = $data['steps'][$step];
            $entry = [
                'on' => (bool) ($in['on'] ?? false),
                'template' => trim((string) ($in['template'] ?? '')),
                'language' => trim((string) ($in['language'] ?? '')),
                'fields' => array_values($in['fields'] ?? []),
            ];
            $label = self::LABELS[$step];

            if ($entry['template'] === '') {
                $entry['fields'] = [];
                if ($entry['on']) {
                    $errors["steps.$step.template"] = "{$label}: choose a template to switch this message on.";
                }
            } elseif (! $template = WhatsAppFlow::find($entry['template'], $entry['language'])) {
                $errors["steps.$step.template"] = "{$label}: that template is not in your AiGrowBot account. Press “Reload templates” and choose again.";
            } elseif ($entry['on'] && $template['blocked']) {
                $errors["steps.$step.template"] = "{$label}: “{$template['name']}” can't be sent — {$template['blocked']}";
            } elseif (count($entry['fields']) !== count($template['vars'])) {
                $errors["steps.$step.fields"] = "{$label}: choose what fills each of the template's ".count($template['vars']).' blanks.';
            }

            $flow[$step] = $entry;
        }

        if ($errors) {
            throw ValidationException::withMessages($errors);
        }

        WhatsAppFlow::saveFlow($flow);

        return response()->json(['data' => $this->payload()]);
    }

    /**
     * Send one step's saved template, filled with a made-up order, to the
     * number the admin types — so they see exactly what customers will get.
     */
    public function test(Request $request)
    {
        $data = $request->validate([
            'step' => ['required', Rule::in(array_keys(WhatsAppFlow::STEPS))],
            'phone' => ['required', 'string', 'max:20'],
        ]);

        $phone = AiGrowBot::phone($data['phone']);
        if (! $phone || ! preg_match('/^\d{11,15}$/', $phone)) {
            throw ValidationException::withMessages(['phone' => 'Enter a WhatsApp number: 10 digits, or with its country code.']);
        }

        if (! AiGrowBot::apiEnabled()) {
            return response()->json(['message' => 'Save your AiGrowBot Tenant Subdomain and API Token first.'], 422);
        }

        $entry = WhatsAppFlow::flow()[$data['step']];
        if ($entry['template'] === '') {
            return response()->json(['message' => 'Choose a template for this message and save it first.'], 422);
        }

        $sample = AiGrowBot::sampleOrder();

        try {
            // No contact name: the number is the admin's own, not a customer's.
            AiGrowBot::sendTemplate($entry['template'], $entry['language'], $phone, WhatsAppFlow::fill($entry['fields'], $sample));
        } catch (Throwable $e) {
            WhatsAppFlow::note($data['step'], $sample['order_number'], false, $e->getMessage(), test: true);

            return response()->json(['message' => $e->getMessage()], 422);
        }

        WhatsAppFlow::note($data['step'], $sample['order_number'], true, 'Test sent to +'.$phone.'.', test: true);

        return response()->json([
            'message' => 'Sent — check WhatsApp on +'.$phone.'.',
            'data' => $this->payload(),
        ]);
    }

    private function payload(): array
    {
        $sample = WhatsAppFlow::values(AiGrowBot::sampleOrder());

        return [
            'connected' => AiGrowBot::apiEnabled(),
            'disconnected' => \App\Support\GatewayCredentials::isOff('whatsapp_api'),
            'webhook' => AiGrowBot::enabled(),
            'steps' => collect(WhatsAppFlow::flow())
                ->map(fn (array $entry, string $step) => $entry + [
                    'key' => $step,
                    'label' => self::LABELS[$step],
                    'when' => self::WHEN[$step],
                    'suggest' => self::SUGGEST[$step],
                ])
                ->values(),
            'fields' => collect(WhatsAppFlow::FIELDS)
                ->map(fn (string $label, string $key) => ['key' => $key, 'label' => $label, 'sample' => $sample[$key]])
                ->values(),
            'templates' => WhatsAppFlow::templates(),
            'log' => WhatsAppFlow::recent(),
        ];
    }
}
