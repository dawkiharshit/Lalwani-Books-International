<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\GatewayCredentials;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The admin's "Test Shiprocket login" button, against a faked Shiprocket.
 *
 * Runs inside a rolled-back transaction, so it needs an already-migrated
 * database (the default in-memory SQLite has no tables), e.g.:
 *   DB_CONNECTION=mysql DB_DATABASE=lalwani_books_test php artisan test --filter=ShiprocketLoginTest
 */
class ShiprocketLoginTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();

        Http::preventStrayRequests();
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));
        GatewayCredentials::set('shiprocket_email', 'owner@example.test');
        GatewayCredentials::set('shiprocket_password', 'not-an-api-user');
    }

    public function test_a_refused_login_says_why_and_asks_for_an_api_user(): void
    {
        Http::fake(['*/auth/login' => Http::response(
            ['message' => 'Invalid email and password combination', 'status_code' => 403],
            403
        )]);

        $message = $this->postJson('/api/v1/admin/integrations/delivery/test')
            ->assertStatus(422)
            ->json('message');

        $this->assertStringContainsString('Invalid email and password combination', $message);
        $this->assertStringContainsString('API user', $message);
        $this->assertStringContainsString('Settings → API → Configure → Create an API User', $message);
    }

    public function test_an_outage_is_not_blamed_on_the_password(): void
    {
        Http::fake(['*/auth/login' => Http::response('Bad Gateway', 502)]);

        $message = $this->postJson('/api/v1/admin/integrations/delivery/test')
            ->assertStatus(422)
            ->json('message');

        $this->assertStringContainsString('not answering', $message);
        $this->assertStringNotContainsString('API user', $message);
    }

    /** The admin's "Save & test": what was saved a moment ago is what gets tested. */
    public function test_details_saved_just_before_the_test_are_the_ones_tested(): void
    {
        Http::fake(['*/auth/login' => Http::response(['token' => 'test-token'], 200)]);

        $this->putJson('/api/v1/admin/integrations/delivery', [
            'shiprocket_email' => 'api-user@example.test',
            'shiprocket_password' => 'api-user-password',
        ])->assertOk();

        $this->postJson('/api/v1/admin/integrations/delivery/test')->assertOk();

        Http::assertSent(fn ($request) => $request['email'] === 'api-user@example.test'
            && $request['password'] === 'api-user-password');
        Http::assertNotSent(fn ($request) => $request['email'] === 'owner@example.test');
    }

    public function test_api_user_credentials_connect(): void
    {
        Http::fake(['*/auth/login' => Http::response(['token' => 'test-token'], 200)]);

        $this->postJson('/api/v1/admin/integrations/delivery/test')
            ->assertOk()
            ->assertJson(['message' => 'Shiprocket login succeeded.']);

        // The saved password is what gets sent, decrypted.
        Http::assertSent(fn ($request) => str_ends_with($request->url(), '/auth/login')
            && $request['email'] === 'owner@example.test'
            && $request['password'] === 'not-an-api-user');
    }
}
