<?php

namespace Tests\Feature;

use App\Models\Setting;
use App\Models\User;
use App\Services\AiGrowBot;
use App\Services\GoogleOAuth;
use App\Services\Razorpay;
use App\Support\GatewayCredentials;
use App\Support\MailConfig;
use App\Support\WhatsAppFlow;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\Client\Request as SentRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Admin → Integrations → Disconnect / Connect again: an integration can be
 * switched off without losing its details.
 *
 * Runs inside a rolled-back transaction, so it needs an already-migrated
 * database (the default in-memory SQLite has no tables), e.g.:
 *   DB_CONNECTION=mysql DB_DATABASE=lalwani_books_test php artisan test --filter=IntegrationDisconnectTest
 */
class IntegrationDisconnectTest extends TestCase
{
    use DatabaseTransactions;

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

    public function test_disconnecting_whatsapp_stops_the_messages_but_keeps_the_details(): void
    {
        $this->withoutDefer();
        GatewayCredentials::set('aigrowbot_tenant', 'lalwani');
        GatewayCredentials::set('aigrowbot_api_token', 'token-for-tests');
        WhatsAppFlow::saveFlow(['shipped' => [
            'on' => true, 'template' => 'order_shipped', 'language' => 'en', 'fields' => ['customer_name'],
        ]]);
        Http::fake(['https://app.aigrowbot.com/api/v1/lalwani/messages/template' => Http::response(['success' => true])]);

        $this->postJson('/api/v1/admin/integrations/whatsapp_api/disconnect')
            ->assertOk()
            ->assertJsonPath('data.disconnected', true)
            ->assertJsonPath('data.enabled', false)
            // Still there, ready for "Connect again"; the token still hidden.
            ->assertJsonPath('data.fields.aigrowbot_tenant.value', 'lalwani')
            ->assertJsonPath('data.fields.aigrowbot_api_token.set', true)
            ->assertJsonPath('data.fields.aigrowbot_api_token.value', null);

        $this->assertFalse(AiGrowBot::apiEnabled());
        AiGrowBot::notify('order.shipped', ['order_number' => 'LBI-1', 'phone' => '919876543210', 'customer_name' => 'Asha']);
        Http::assertNothingSent();

        $this->postJson('/api/v1/admin/integrations/whatsapp_api/test')
            ->assertStatus(422)
            ->assertJsonPath('message', 'This is disconnected — press “Connect again” first.');
        $this->getJson('/api/v1/admin/whatsapp')
            ->assertJsonPath('data.disconnected', true)
            ->assertJsonPath('data.connected', false);

        $this->postJson('/api/v1/admin/integrations/whatsapp_api/connect')
            ->assertOk()
            ->assertJsonPath('data.disconnected', false)
            ->assertJsonPath('data.enabled', true);

        AiGrowBot::notify('order.shipped', ['order_number' => 'LBI-2', 'phone' => '919876543210', 'customer_name' => 'Asha']);
        Http::assertSent(fn (SentRequest $r) => $r['phone_number'] === '+919876543210');
    }

    public function test_a_disconnected_integration_ignores_its_env_details_too(): void
    {
        config([
            'gateways.env.razorpay_key_id' => 'rzp_test_from_env',
            'gateways.env.razorpay_key_secret' => 'secret-from-env',
        ]);
        $this->assertTrue(Razorpay::enabled());

        $this->postJson('/api/v1/admin/integrations/payment/disconnect')
            ->assertOk()
            ->assertJsonPath('data.enabled', false);
        $this->assertFalse(Razorpay::enabled());
        $this->assertSame('', Razorpay::keyId());

        $this->postJson('/api/v1/admin/integrations/payment/connect')->assertOk();
        $this->assertTrue(Razorpay::enabled());
    }

    public function test_disconnected_smtp_details_are_not_applied(): void
    {
        GatewayCredentials::set('mail_host', 'smtp.example.test');
        GatewayCredentials::set('mail_from_address', 'shop@example.test');
        $this->assertTrue(MailConfig::configured());

        $this->postJson('/api/v1/admin/integrations/mail/disconnect')->assertOk();

        $this->assertFalse(MailConfig::configured());
    }

    public function test_saving_while_disconnected_keeps_it_disconnected(): void
    {
        $this->postJson('/api/v1/admin/integrations/google/disconnect')->assertOk();

        $this->putJson('/api/v1/admin/integrations/google', [
            'google_client_id' => 'shop.apps.googleusercontent.com',
            'google_client_secret' => 'client-secret',
        ])
            ->assertOk()
            ->assertJsonPath('data.disconnected', true)
            ->assertJsonPath('data.enabled', false)
            ->assertJsonPath('data.fields.google_client_id.value', 'shop.apps.googleusercontent.com');

        $this->assertFalse(GoogleOAuth::enabled());
    }

    public function test_unknown_integrations_and_customers_are_refused(): void
    {
        $this->postJson('/api/v1/admin/integrations/nope/disconnect')->assertNotFound();

        Sanctum::actingAs(User::factory()->create(['is_admin' => false]));
        $this->postJson('/api/v1/admin/integrations/payment/disconnect')->assertForbidden();

        $this->assertFalse(GatewayCredentials::isOff('payment'));
    }
}
