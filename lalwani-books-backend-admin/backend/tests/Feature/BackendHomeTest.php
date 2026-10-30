<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Config;
use Tests\TestCase;

class BackendHomeTest extends TestCase
{
    public function test_the_home_page_answers_without_a_template(): void
    {
        $response = $this->get('/');

        $response->assertStatus(200);
        $response->assertSee('Lalwani Books International');
        $response->assertSee('noindex', false);

        // Plain text on purpose. A Blade view has to be compiled into
        // storage/framework/views first, and on a server where that folder is
        // missing this address showed a bare 500 while the API answered fine.
        $this->assertIsString($response->baseResponse->original);
    }

    public function test_the_home_page_answers_with_no_session_store(): void
    {
        // The live site keeps sessions in a database table. If that table is
        // absent — a half-finished import — every page in the web group dies.
        // This one is outside it, so the backend can still say what it is.
        Config::set('session.driver', 'database');
        Config::set('session.connection', 'sqlite');
        Config::set('session.table', 'no_such_sessions_table');

        $this->get('/')->assertStatus(200);
    }

    public function test_the_home_page_points_at_the_shop(): void
    {
        Config::set('app.frontend_url', 'https://shop.example.com');

        $this->get('/')->assertSee('href="https://shop.example.com"', false);
    }

    public function test_the_home_page_has_no_link_when_the_shop_address_is_unset(): void
    {
        Config::set('app.frontend_url', '');

        $this->get('/')->assertStatus(200)->assertDontSee('<a href', false);
    }

    public function test_the_home_page_still_carries_the_security_headers(): void
    {
        $this->get('/')->assertHeader('X-Content-Type-Options', 'nosniff');
    }
}
