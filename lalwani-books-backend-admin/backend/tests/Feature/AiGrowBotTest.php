<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Setting;
use App\Models\User;
use App\Support\GatewayCredentials;
use App\Support\OrderNotifier;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Admin → WhatsApp (AiGrowBot), against a faked AiGrowBot.
 *
 * Runs inside a rolled-back transaction, so it needs an already-migrated
 * database (the default in-memory SQLite has no tables), e.g.:
 *   DB_CONNECTION=mysql DB_DATABASE=lalwani_books_test php artisan test --filter=AiGrowBotTest
 */
class AiGrowBotTest extends TestCase
{
    use DatabaseTransactions;

    private const HOOK = 'https://hooks.aigrowbot.test/webhook/abc123';

    protected function setUp(): void
    {
        parent::setUp();

        Http::preventStrayRequests();
        Mail::fake();
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));
    }

    private function connect(string $url = self::HOOK): void
    {
        GatewayCredentials::set('aigrowbot_webhook_url', $url);
        GatewayCredentials::set('aigrowbot_api_username', 'lalwani-shop');
        GatewayCredentials::set('aigrowbot_secret_key', 'super-secret-key');
    }

    private function order(): Order
    {
        $order = Order::create([
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
        ]);
        OrderItem::create(['order_id' => $order->id, 'name' => 'Malgudi Days', 'unit_price' => 349, 'quantity' => 1, 'total' => 349]);

        return $order;
    }

    public function test_saved_details_keep_the_secret_key_hidden_and_encrypted(): void
    {
        $res = $this->putJson('/api/v1/admin/integrations/whatsapp', [
            'aigrowbot_webhook_url' => self::HOOK,
            'aigrowbot_api_username' => 'lalwani-shop',
            'aigrowbot_secret_key' => 'super-secret-key',
        ])->assertOk();

        $res->assertJsonPath('data.enabled', true)
            ->assertJsonPath('data.fields.aigrowbot_webhook_url.value', self::HOOK)
            ->assertJsonPath('data.fields.aigrowbot_secret_key.value', null)
            ->assertJsonPath('data.fields.aigrowbot_secret_key.set', true);
        $this->assertStringNotContainsString('super-secret-key', $res->getContent());
        $this->assertNotSame('super-secret-key', Setting::get('gw_aigrowbot_secret_key'));
        $this->assertSame('super-secret-key', GatewayCredentials::get('aigrowbot_secret_key'));
    }

    public function test_the_webhook_must_be_an_https_address(): void
    {
        foreach (['http://hooks.aigrowbot.test/x', 'javascript:alert(1)', 'not a url'] as $bad) {
            $this->putJson('/api/v1/admin/integrations/whatsapp', ['aigrowbot_webhook_url' => $bad])
                ->assertStatus(422)
                ->assertJsonValidationErrors('aigrowbot_webhook_url');
        }
    }

    public function test_the_test_button_posts_a_signed_event(): void
    {
        $this->connect();
        Http::fake([self::HOOK => Http::response(['status' => 'ok'])]);

        $this->postJson('/api/v1/admin/integrations/whatsapp/test')
            ->assertOk()
            ->assertJsonPath('message', 'AiGrowBot accepted the test event.');

        Http::assertSent(fn ($r) => $r->url() === self::HOOK
            && $r->hasHeader('Authorization', 'Basic '.base64_encode('lalwani-shop:super-secret-key'))
            && $r->header('X-Api-Username')[0] === 'lalwani-shop'
            && $r->header('X-Signature')[0] === 'sha256='.hash_hmac('sha256', $r->body(), 'super-secret-key')
            && $r['event'] === 'test'
            && $r['data']['order_number'] === 'LBI-TEST-0001');
    }

    public function test_a_refused_key_is_explained(): void
    {
        $this->connect();
        Http::fake([self::HOOK => Http::response(['message' => 'Invalid credentials'], 401)]);

        $message = $this->postJson('/api/v1/admin/integrations/whatsapp/test')->assertStatus(422)->json('message');

        $this->assertStringContainsString('refused the API username or secret key', $message);
        $this->assertStringContainsString('Invalid credentials', $message);
    }

    public function test_private_and_local_addresses_are_never_called(): void
    {
        foreach (['https://127.0.0.1/hook', 'https://localhost/hook', 'https://192.168.1.10/hook', 'https://10.0.0.5/hook'] as $url) {
            $this->connect($url);
            $message = $this->postJson('/api/v1/admin/integrations/whatsapp/test')->assertStatus(422)->json('message');
            $this->assertStringContainsString('public address', $message);
        }
        Http::assertNothingSent();
    }

    public function test_shipping_an_order_sends_its_whatsapp_event(): void
    {
        $this->withoutDefer();
        $this->connect();
        Http::fake([self::HOOK => Http::response(['status' => 'ok'])]);
        $order = $this->order();

        OrderNotifier::statusChanged($order, 'processing', 'shipped');

        Http::assertSent(fn ($r) => $r['event'] === 'order.shipped'
            && $r['data']['order_number'] === $order->order_number
            && $r['data']['phone'] === '919876543210'
            && $r['data']['items'][0]['name'] === 'Malgudi Days');
    }

    public function test_nothing_is_sent_while_not_connected(): void
    {
        $this->withoutDefer();
        $order = $this->order();

        OrderNotifier::statusChanged($order, 'processing', 'delivered');

        Http::assertNothingSent();
    }
}
