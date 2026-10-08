<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\CheckoutController;
use App\Models\Setting;
use App\Support\ShippingQuote;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * The shipping charged at checkout must match what the cart page promises.
 *
 * Runs inside a rolled-back transaction, so it needs an already-migrated
 * database (the default in-memory SQLite has no tables), e.g.:
 *   DB_CONNECTION=mysql DB_DATABASE=lalwani_books_test php artisan test --filter=ShippingQuoteTest
 */
class ShippingQuoteTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
    }

    /** The bug: with no saved row, checkout read the charge as 0 and shipped free. */
    public function test_an_unsaved_shipping_setting_falls_back_to_the_store_default_not_zero(): void
    {
        Setting::whereIn('key', ['flat_shipping', 'free_shipping_threshold'])->delete();
        Setting::flush();

        $small = ShippingQuote::for(598.0, 0.5, null, true);
        $this->assertSame((float) CheckoutController::FLAT_SHIPPING, $small['charge']);
        $this->assertSame('flat_rate', $small['source']);

        $big = ShippingQuote::for((float) CheckoutController::FREE_SHIPPING_THRESHOLD, 0.5, null, false);
        $this->assertSame(0.0, $big['charge']);
        $this->assertSame('free_over_threshold', $big['source']);
    }

    public function test_saved_values_are_used_when_present(): void
    {
        Setting::set('flat_shipping', '99');
        Setting::set('free_shipping_threshold', '1000');

        $this->assertSame(99.0, ShippingQuote::for(500.0, 0.5, null, false)['charge']);
        $this->assertSame(0.0, ShippingQuote::for(1000.0, 0.5, null, false)['charge']);
    }
}
