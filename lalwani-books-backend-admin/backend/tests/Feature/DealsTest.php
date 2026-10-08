<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Deal;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Deals Of The Week: written in admin → Deals, published to the home page
 * slider, and never able to carry a link that runs script.
 *
 * Runs inside a rolled-back transaction, so it needs an already-migrated
 * database (the default in-memory SQLite has no tables), e.g.:
 *   DB_CONNECTION=mysql DB_DATABASE=lalwani_books_test php artisan test --filter=DealsTest
 */
class DealsTest extends TestCase
{
    use DatabaseTransactions;

    private function signInAsAdmin(): void
    {
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));
    }

    public function test_an_admin_creates_a_deal_and_the_shop_lists_it(): void
    {
        $this->signInAsAdmin();
        Deal::query()->delete();
        $shelf = Category::query()->firstOrFail();

        $id = $this->postJson('/api/v1/admin/deals', [
            'eyebrow' => 'Fiction favourites',
            'heading' => 'Novels up to {discount}% off',
            'description' => 'Reduced this week.',
            'ends_label' => 'Ends Sunday midnight',
            'button_text' => 'Shop fiction',
            'button_url' => '/collection?category=fiction',
            'category_id' => $shelf->id,
            'theme' => 'pine',
        ])->assertCreated()
            ->assertJsonPath('data.theme', 'pine')
            ->assertJsonPath('data.is_active', true)
            ->json('data.id');

        $this->getJson('/api/v1/deals')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $id)
            ->assertJsonPath('data.0.heading', 'Novels up to {discount}% off')
            ->assertJsonPath('data.0.category.slug', $shelf->slug)
            ->assertJsonPath('data.0.ends_at', null);

        // The list's on/off switch sends only is_active; everything else stays.
        $this->putJson("/api/v1/admin/deals/{$id}", ['is_active' => false])->assertOk()
            ->assertJsonPath('data.is_active', false)
            ->assertJsonPath('data.heading', 'Novels up to {discount}% off')
            ->assertJsonPath('data.button_url', '/collection?category=fiction');
        $this->getJson('/api/v1/deals')->assertOk()->assertJsonCount(0, 'data');

        $this->deleteJson("/api/v1/admin/deals/{$id}")->assertOk();
        $this->assertNull(Deal::find($id));
    }

    public function test_switched_off_and_finished_deals_stay_off_the_shop(): void
    {
        Deal::query()->delete();
        Deal::create(['heading' => 'Second', 'theme' => 'coral', 'sort_order' => 2]);
        Deal::create(['heading' => 'First', 'theme' => 'plum', 'sort_order' => 1]);
        Deal::create(['heading' => 'Off', 'theme' => 'coral', 'is_active' => false, 'sort_order' => 0]);
        Deal::create(['heading' => 'Over', 'theme' => 'coral', 'ends_at' => now()->subMinute(), 'sort_order' => 0]);
        Deal::create(['heading' => 'Later', 'theme' => 'ocean', 'ends_at' => now()->addDay(), 'sort_order' => 3]);

        $live = $this->getJson('/api/v1/deals')->assertOk()->json('data');

        $this->assertSame(['First', 'Second', 'Later'], array_column($live, 'heading'));
        // A dated deal tells the countdown exactly when it ends.
        $this->assertNotNull($live[2]['ends_at']);
    }

    public function test_only_safe_button_links_are_accepted(): void
    {
        $this->signInAsAdmin();
        $deal = ['heading' => 'Link check', 'theme' => 'coral', 'button_text' => 'Go'];

        foreach (['javascript:alert(1)', 'JaVaScRiPt:alert(1)', '//evil.example', '/\\evil.example', 'data:text/html,hi', 'collection', 'https://'] as $bad) {
            $this->postJson('/api/v1/admin/deals', $deal + ['button_url' => $bad])
                ->assertUnprocessable()
                ->assertJsonValidationErrors('button_url');
        }
        foreach (['/collection?category=fiction', 'https://lalwanibooks.com/blog'] as $good) {
            $this->postJson('/api/v1/admin/deals', $deal + ['button_url' => $good])->assertCreated();
        }

        // Hero banner buttons follow the same rule.
        $this->postJson('/api/v1/admin/banners', ['title' => 'x', 'button_text' => 'Go', 'button_url' => 'javascript:alert(1)'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('button_url');
    }

    public function test_a_deal_needs_a_heading_and_a_known_colour(): void
    {
        $this->signInAsAdmin();

        $this->postJson('/api/v1/admin/deals', ['theme' => 'coral'])
            ->assertUnprocessable()->assertJsonValidationErrors('heading');
        $this->postJson('/api/v1/admin/deals', ['heading' => 'Neon', 'theme' => 'neon'])
            ->assertUnprocessable()->assertJsonValidationErrors('theme');
        $this->postJson('/api/v1/admin/deals', ['heading' => 'Lost shelf', 'theme' => 'coral', 'category_id' => 999999])
            ->assertUnprocessable()->assertJsonValidationErrors('category_id');
    }

    public function test_customers_cannot_manage_deals(): void
    {
        $this->postJson('/api/v1/admin/deals', ['heading' => 'x', 'theme' => 'coral'])->assertUnauthorized();

        Sanctum::actingAs(User::factory()->create(['is_admin' => false]));
        $this->postJson('/api/v1/admin/deals', ['heading' => 'x', 'theme' => 'coral'])->assertForbidden();
        $this->getJson('/api/v1/admin/deals')->assertForbidden();
    }
}
