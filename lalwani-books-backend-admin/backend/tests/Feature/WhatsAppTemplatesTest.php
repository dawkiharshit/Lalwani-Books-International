<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Setting;
use App\Models\User;
use App\Services\AiGrowBot;
use App\Services\Razorpay;
use App\Support\GatewayCredentials;
use App\Support\OrderNotifier;
use App\Support\WhatsAppFlow;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\Client\Request as SentRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Admin → WhatsApp → Order messages: the account's own AiGrowBot templates,
 * sent at each order step, against a faked AiGrowBot.
 *
 * Runs inside a rolled-back transaction, so it needs an already-migrated
 * database (the default in-memory SQLite has no tables), e.g.:
 *   DB_CONNECTION=mysql DB_DATABASE=lalwani_books_test php artisan test --filter=WhatsAppTemplatesTest
 */
class WhatsAppTemplatesTest extends TestCase
{
    use DatabaseTransactions;

    private const API = 'https://app.aigrowbot.com/api/v1/lalwani';

    private const HOOK = 'https://hooks.aigrowbot.test/webhook/abc123';

    protected function setUp(): void
    {
        parent::setUp();

        // Settings are memoised per process; start from what the database says.
        Setting::flush();
        Http::preventStrayRequests();
        Mail::fake();
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));
    }

    protected function tearDown(): void
    {
        Setting::flush();

        parent::tearDown();
    }

    /** Three templates as AiGrowBot lists them: two approved, one still pending. */
    private function templates(): array
    {
        return ['status' => 'success', 'data' => [
            [
                'template_name' => 'order_shipped',
                'language' => 'en',
                'status' => 'APPROVED',
                'category' => 'UTILITY',
                'header_data_format' => 'TEXT',
                'header_data_text' => 'Your books are on the way',
                'body_data' => "Hi {{1}}, your order {{2}} has left our shop with {{3}}.\nTrack it here: {{4}}",
                'body_params_count' => 4,
                'footer_data' => 'Lalwani Books International',
                'buttons_data' => '[{"type":"QUICK_REPLY","text":"Thanks"}]',
            ],
            [
                'template_name' => 'order_confirmed',
                'language' => 'en',
                'status' => 'APPROVED',
                'category' => 'UTILITY',
                'body_data' => 'Thank you {{1}}! Order {{2}} for {{3}} is confirmed.',
                'body_params_count' => 3,
            ],
            [
                'template_name' => 'diwali_offer',
                'language' => 'hi',
                'status' => 'PENDING',
                'category' => 'MARKETING',
                'body_data' => 'Diwali offer for {{1}}',
            ],
        ]];
    }

    private function connect(): void
    {
        GatewayCredentials::set('aigrowbot_tenant', 'lalwani');
        GatewayCredentials::set('aigrowbot_api_token', '12|token-for-tests');
    }

    /** Connected, templates loaded, and "Order shipped" set to order_shipped. */
    private function shippedFlow(): void
    {
        $this->connect();
        Http::fake([self::API.'/templates' => Http::response($this->templates())]);
        WhatsAppFlow::refreshTemplates();
        WhatsAppFlow::saveFlow(['shipped' => [
            'on' => true,
            'template' => 'order_shipped',
            'language' => 'en',
            'fields' => ['customer_name', 'order_number', 'courier', 'tracking_url'],
        ]]);
    }

    private function order(array $overrides = []): Order
    {
        $order = Order::create(array_merge([
            'order_number' => 'LBI-TEST-'.uniqid(),
            'email' => 'buyer@example.test',
            'status' => 'processing',
            'payment_method' => 'cod',
            'payment_status' => 'pending',
            'subtotal' => 349, 'discount' => 0, 'shipping' => 0, 'tax' => 0, 'total' => 349,
            'ship_name' => 'Asha Rao',
            'ship_phone' => '+91 98765 43210',
            'ship_address1' => '12 MG Road',
            'ship_city' => 'New Delhi',
            'ship_state' => 'Delhi',
            'ship_zip' => '110044',
            'ship_country' => 'India',
            'placed_at' => now(),
        ], $overrides));
        OrderItem::create(['order_id' => $order->id, 'name' => 'Malgudi Days', 'unit_price' => 349, 'quantity' => 1, 'total' => 349]);

        return $order;
    }

    private function sentTemplates(): array
    {
        return Http::recorded(fn (SentRequest $r) => $r->url() === self::API.'/messages/template')
            ->map(fn ($pair) => $pair[0])
            ->all();
    }

    public function test_the_account_is_saved_with_its_token_hidden_and_encrypted(): void
    {
        $res = $this->putJson('/api/v1/admin/integrations/whatsapp_api', [
            // Pasted straight from the browser's address bar, token and all.
            'aigrowbot_tenant' => 'https://app.aigrowbot.com/lalwani/dashboard',
            'aigrowbot_api_token' => 'Bearer 12|token-for-tests',
        ])->assertOk();

        $res->assertJsonPath('data.enabled', true)
            ->assertJsonPath('data.fields.aigrowbot_tenant.value', 'lalwani')
            ->assertJsonPath('data.fields.aigrowbot_api_token.value', null)
            ->assertJsonPath('data.fields.aigrowbot_api_token.set', true);
        $this->assertStringNotContainsString('token-for-tests', $res->getContent());
        $this->assertStringNotContainsString('token-for-tests', (string) Setting::get('gw_aigrowbot_api_token'));
        $this->assertSame('12|token-for-tests', GatewayCredentials::get('aigrowbot_api_token'));
    }

    public function test_the_tenant_subdomain_must_be_just_one_word(): void
    {
        foreach (['../admin', 'lalwani/../x', 'name?x=1'] as $bad) {
            $this->putJson('/api/v1/admin/integrations/whatsapp_api', ['aigrowbot_tenant' => $bad])
                ->assertStatus(422)
                ->assertJsonValidationErrors('aigrowbot_tenant');
        }

        // The usual mix-ups get told what went wrong, and what was typed.
        $said = fn (string $typed) => $this->putJson('/api/v1/admin/integrations/whatsapp_api', ['aigrowbot_tenant' => $typed])
            ->assertStatus(422)
            ->json('errors.aigrowbot_tenant.0');
        $this->assertStringContainsString('looks like an email address', $said('owner@lalwanibooks.in'));
        $this->assertStringContainsString('“Lalwani Books” has spaces', $said('Lalwani Books'));
        $this->assertStringContainsString('Copy the Tenant Subdomain from AiGrowBot → Settings → API Management', $said('lalwani.books'));

        $this->assertSame('', GatewayCredentials::get('aigrowbot_tenant'));
    }

    public function test_what_copying_from_a_web_page_adds_is_tidied_away(): void
    {
        $saved = fn (string $typed) => $this->putJson('/api/v1/admin/integrations/whatsapp_api', ['aigrowbot_tenant' => $typed])
            ->assertOk()
            ->json('data.fields.aigrowbot_tenant.value');

        // Non-breaking and zero-width spaces, quotes, a new line.
        $this->assertSame('lalwani', $saved("\u{00A0}lalwani\u{200B}\n"));
        $this->assertSame('lalwani-books', $saved('“lalwani-books”'));
        // The "Example Endpoint" and "API Base URL + subdomain" from API Management.
        $this->assertSame('lalwani', $saved('https://app.aigrowbot.com/api/v1/lalwani/templates'));
        $this->assertSame('lalwani2', $saved('app.aigrowbot.com/api/v1/lalwani2'));

        // The token loses a copied "Bearer " and any invisible spaces.
        $this->putJson('/api/v1/admin/integrations/whatsapp_api', ['aigrowbot_api_token' => " 08a94a4f\u{200B}b1bd7fbd \u{00A0}"])->assertOk();
        $this->assertSame('08a94a4fb1bd7fbd', GatewayCredentials::get('aigrowbot_api_token'));
    }

    public function test_loading_templates_reads_them_and_sends_nothing(): void
    {
        $this->connect();
        Http::fake([self::API.'/templates' => Http::response($this->templates())]);

        $this->postJson('/api/v1/admin/integrations/whatsapp_api/test')
            ->assertOk()
            ->assertJsonPath('message', 'Connected — found 3 templates (2 approved). Choose them under Order messages below.');

        Http::assertSentCount(1);
        Http::assertSent(fn (SentRequest $r) => $r->method() === 'GET'
            && $r->url() === self::API.'/templates'
            && $r->hasHeader('Authorization', 'Bearer 12|token-for-tests'));

        $data = $this->getJson('/api/v1/admin/whatsapp')->assertOk()->json('data');
        $shipped = collect($data['templates']['items'])->firstWhere('name', 'order_shipped');

        $this->assertTrue($data['connected']);
        $this->assertSame(['1', '2', '3', '4'], $shipped['vars']);
        $this->assertNull($shipped['blocked']);
        $this->assertSame('WhatsApp has not approved it yet.', collect($data['templates']['items'])->firstWhere('name', 'diwali_offer')['blocked']);
        // Approved ones are listed first.
        $this->assertSame('diwali_offer', end($data['templates']['items'])['name']);
    }

    public function test_every_page_of_templates_is_read(): void
    {
        $this->connect();
        [$first, $second, $third] = $this->templates()['data'];
        Http::fake([
            self::API.'/templates?page=2' => Http::response(['data' => ['data' => [$third], 'last_page' => 2]]),
            self::API.'/templates' => Http::response(['data' => ['data' => [$first, $second], 'last_page' => 2]]),
        ]);

        $this->assertCount(3, WhatsAppFlow::refreshTemplates()['items']);
        Http::assertSentCount(2);
    }

    public function test_a_refused_token_and_an_unknown_account_are_explained(): void
    {
        $this->connect();
        Http::fake([self::API.'/templates' => Http::sequence()
            ->push(['message' => 'Unauthenticated.'], 401)
            ->push(['status' => 'error', 'message' => 'Validation failed', 'errors' => 'Invalid tenant subdomain'], 500),
        ]);

        $first = $this->postJson('/api/v1/admin/integrations/whatsapp_api/test')->assertStatus(422)->json('message');
        $second = $this->postJson('/api/v1/admin/integrations/whatsapp_api/test')->assertStatus(422)->json('message');

        $this->assertStringContainsString('refused the API token', $first);
        $this->assertStringContainsString('does not know that Tenant Subdomain', $second);
        $this->assertStringNotContainsString('token-for-tests', $first.$second);
    }

    public function test_saving_order_messages_checks_the_template_and_its_blanks(): void
    {
        $this->connect();
        Http::fake([self::API.'/templates' => Http::response($this->templates())]);
        WhatsAppFlow::refreshTemplates();

        $save = fn (array $step) => $this->putJson('/api/v1/admin/whatsapp', ['steps' => ['shipped' => $step]]);

        // Too few blanks filled.
        $save(['on' => true, 'template' => 'order_shipped', 'language' => 'en', 'fields' => ['customer_name']])
            ->assertStatus(422)->assertJsonValidationErrors('steps.shipped.fields');
        // Not approved by WhatsApp.
        $save(['on' => true, 'template' => 'diwali_offer', 'language' => 'hi', 'fields' => ['customer_name']])
            ->assertStatus(422)->assertJsonValidationErrors('steps.shipped.template');
        // Not in the account at all.
        $save(['on' => true, 'template' => 'made_up', 'language' => 'en', 'fields' => []])
            ->assertStatus(422)->assertJsonValidationErrors('steps.shipped.template');
        // Something that is not an order detail.
        $save(['on' => true, 'template' => 'order_confirmed', 'language' => 'en', 'fields' => ['customer_name', 'email', 'total']])
            ->assertStatus(422)->assertJsonValidationErrors('steps.shipped.fields.1');

        $save(['on' => true, 'template' => 'order_shipped', 'language' => 'en', 'fields' => ['customer_name', 'order_number', 'courier', 'tracking_url']])
            ->assertOk()
            ->assertJsonPath('data.steps.1.key', 'shipped')
            ->assertJsonPath('data.steps.1.on', true)
            ->assertJsonPath('data.steps.1.template', 'order_shipped');

        $this->assertSame('order_shipped', WhatsAppFlow::forEvent('order.shipped')['template']);
        $this->assertNull(WhatsAppFlow::forEvent('order.delivered'));
    }

    public function test_shipping_an_order_sends_the_chosen_template_instead_of_the_webhook(): void
    {
        $this->withoutDefer();
        $this->shippedFlow();
        // The webhook is connected too, but a step with a template goes out once.
        GatewayCredentials::set('aigrowbot_webhook_url', self::HOOK);
        GatewayCredentials::set('aigrowbot_api_username', 'lalwani-shop');
        GatewayCredentials::set('aigrowbot_secret_key', 'super-secret-key');
        Http::fake([self::API.'/messages/template' => Http::response(['success' => true, 'data' => ['message_id' => 'wamid.x', 'status' => 'sent']])]);
        $order = $this->order();

        OrderNotifier::statusChanged($order, 'processing', 'shipped');

        $sent = $this->sentTemplates();
        $this->assertCount(1, $sent);
        $this->assertSame('+919876543210', $sent[0]['phone_number']);
        $this->assertSame('order_shipped', $sent[0]['template_name']);
        $this->assertSame('en', $sent[0]['template_language']);
        $this->assertSame('Asha Rao', $sent[0]['field_1']);
        $this->assertSame($order->order_number, $sent[0]['field_2']);
        $this->assertSame('our courier partner', $sent[0]['field_3']);
        $this->assertStringEndsWith('/account/orders/'.$order->order_number, $sent[0]['field_4']);
        $this->assertSame(['firstname' => 'Asha', 'lastname' => 'Rao'], $sent[0]['contact']);
        Http::assertNotSent(fn (SentRequest $r) => $r->url() === self::HOOK);

        $this->assertTrue(WhatsAppFlow::recent()[0]['ok']);
        $this->assertSame($order->order_number, WhatsAppFlow::recent()[0]['order']);
    }

    public function test_a_step_without_a_template_still_goes_to_the_webhook(): void
    {
        $this->withoutDefer();
        $this->shippedFlow();
        GatewayCredentials::set('aigrowbot_webhook_url', self::HOOK);
        GatewayCredentials::set('aigrowbot_api_username', 'lalwani-shop');
        GatewayCredentials::set('aigrowbot_secret_key', 'super-secret-key');
        Http::fake([self::HOOK => Http::response(['status' => 'ok'])]);

        OrderNotifier::statusChanged($this->order(['status' => 'shipped']), 'shipped', 'delivered');

        Http::assertSent(fn (SentRequest $r) => $r->url() === self::HOOK && $r['event'] === 'order.delivered');
        $this->assertSame([], $this->sentTemplates());
    }

    public function test_a_refused_message_is_noted_for_the_admin(): void
    {
        $this->withoutDefer();
        $this->shippedFlow();
        Http::fake([self::API.'/messages/template' => Http::response([
            'success' => false, 'message' => 'Template not found', 'errors' => ['template_name' => ['The template is not approved.']],
        ], 404)]);

        OrderNotifier::statusChanged($this->order(), 'processing', 'shipped');

        $note = WhatsAppFlow::recent()[0];
        $this->assertFalse($note['ok']);
        $this->assertStringContainsString('Template not found', $note['note']);
    }

    public function test_an_online_order_is_confirmed_once_when_its_payment_goes_through(): void
    {
        $this->withoutDefer();
        $this->connect();
        Http::fake([self::API.'/templates' => Http::response($this->templates())]);
        WhatsAppFlow::refreshTemplates();
        WhatsAppFlow::saveFlow(['placed' => [
            'on' => true, 'template' => 'order_confirmed', 'language' => 'en',
            'fields' => ['first_name', 'order_number', 'total'],
        ]]);
        Http::fake([self::API.'/messages/template' => Http::response(['success' => true])]);
        $order = $this->order(['payment_method' => 'razorpay', 'status' => 'pending']);

        // The shopper's browser and Razorpay's webhook both confirm it.
        Razorpay::markPaid($order, 'pay_test_1');
        AiGrowBot::notify('order.placed', AiGrowBot::orderData($order->fresh()));

        $sent = $this->sentTemplates();
        $this->assertCount(1, $sent);
        $this->assertSame('Asha', $sent[0]['field_1']);
        $this->assertSame('₹349', $sent[0]['field_3']);
    }

    public function test_the_test_button_sends_the_saved_template_to_the_typed_number(): void
    {
        $this->shippedFlow();
        Http::fake([self::API.'/messages/template' => Http::response(['success' => true])]);

        $this->postJson('/api/v1/admin/whatsapp/test', ['step' => 'shipped', 'phone' => '98765 00000'])
            ->assertOk()
            ->assertJsonPath('message', 'Sent — check WhatsApp on +919876500000.');

        $sent = $this->sentTemplates();
        $this->assertCount(1, $sent);
        $this->assertSame('+919876500000', $sent[0]['phone_number']);
        $this->assertSame('LBI-TEST-0001', $sent[0]['field_2']);
        // The admin's own number is not saved as a customer contact.
        $this->assertArrayNotHasKey('contact', $sent[0]->data());
        $this->assertTrue(WhatsAppFlow::recent()[0]['test']);

        $this->postJson('/api/v1/admin/whatsapp/test', ['step' => 'shipped', 'phone' => '12345'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('phone');
    }

    public function test_nothing_is_sent_for_a_step_that_is_switched_off(): void
    {
        $this->withoutDefer();
        $this->shippedFlow();

        OrderNotifier::statusChanged($this->order(), 'processing', 'cancelled');

        $this->assertSame([], $this->sentTemplates());
    }

    public function test_every_blank_is_one_line_and_never_empty(): void
    {
        $values = WhatsAppFlow::values([
            'customer_name' => "  Asha\n\tRao   ",
            'order_number' => 'LBI-1',
            'total' => 1249,
            'items' => [
                ['name' => 'Godaan', 'quantity' => 2],
                ['name' => "Malgudi\nDays", 'quantity' => 1],
                ['name' => 'Gitanjali', 'quantity' => 1],
                ['name' => 'Wings of Fire', 'quantity' => 1],
            ],
            'courier' => null,
            'tracking_url' => null,
            'order_url' => '',
        ]);

        $this->assertSame('Asha Rao', $values['customer_name']);
        $this->assertSame('Asha', $values['first_name']);
        $this->assertSame('₹1,249', $values['total']);
        $this->assertSame('Godaan × 2, Malgudi Days, Gitanjali and 1 more', $values['items']);
        $this->assertSame('5', $values['item_count']);
        $this->assertSame('-', $values['tracking_url']);
        foreach ($values as $value) {
            $this->assertNotSame('', $value);
            $this->assertDoesNotMatchRegularExpression('/[\n\t]| {5,}/', $value);
        }
    }
}
