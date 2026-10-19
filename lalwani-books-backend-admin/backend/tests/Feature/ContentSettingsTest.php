<?php

namespace Tests\Feature;

use App\Models\Setting;
use App\Models\Testimonial;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * What the admin Content screens save is what the storefront reads.
 *
 * Runs inside a rolled-back transaction, so it needs an already-migrated
 * database (the default in-memory SQLite has no tables), e.g.:
 *   DB_CONNECTION=mysql DB_DATABASE=lalwani_books_test php artisan test --filter=ContentSettingsTest
 */
class ContentSettingsTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        // The settings map is cached, and a rolled-back test leaves its values
        // in that cache; start each test from what the database holds.
        Setting::flush();
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));
    }

    private function published(): array
    {
        return $this->getJson('/api/v1/settings')->assertOk()->json('data');
    }

    public function test_contact_page_and_home_fields_reach_the_storefront(): void
    {
        $values = [
            // Contact Page screen
            'contact_studio' => 'Visit the shop',
            'support_email' => 'help@example.test',
            'support_phone' => '+91 90000 11111',
            'contact_hours' => 'Mon–Sat, 9am–6pm',
            'contact_address' => "Shop 2\nNew Delhi",
            'contact_map_url' => 'https://maps.example.test/shop',
            'social_youtube' => 'https://youtube.com/@lalwanibooks',
            'contact_faq_1_question' => 'Do you deliver abroad?',
            'contact_faq_1_answer' => 'Within India only. Free over {free_shipping}.',
            // Home Page screen
            'home_instagram_title' => 'On Our Instagram',
            'home_bestsellers_title' => 'Readers’ Favourites',
            'home_rails_enabled' => '0',
        ];

        $this->putJson('/api/v1/admin/settings', $values)->assertOk();

        $out = $this->published();
        foreach ($values as $key => $value) {
            $this->assertSame($value, (string) $out[$key], $key);
        }
    }

    public function test_the_contact_questions_have_defaults_and_can_be_cleared(): void
    {
        $out = $this->published();
        $this->assertSame('How much does delivery cost?', $out['contact_faq_1_question']);
        $this->assertStringContainsString('{free_shipping}', $out['contact_faq_1_answer']);
        $this->assertSame('Follow Us On Instagram', $out['home_instagram_title']);

        // Clearing a question hides it on the storefront (an empty string, not the default).
        $this->putJson('/api/v1/admin/settings', ['contact_faq_4_question' => '', 'contact_faq_4_answer' => ''])->assertOk();

        $out = $this->published();
        $this->assertSame('', $out['contact_faq_4_question']);
        $this->assertSame('', $out['contact_faq_4_answer']);
    }

    public function test_a_testimonial_role_can_be_set_and_edited(): void
    {
        $id = $this->postJson('/api/v1/admin/testimonials', [
            'name' => 'Asha Rao',
            'designation' => 'Teacher',
            'location' => 'New Delhi',
            'content' => 'Lovely editions, quick delivery.',
            'rating' => 5,
        ])->assertCreated()->json('data.id');

        $this->putJson("/api/v1/admin/testimonials/{$id}", [
            'name' => 'Asha Rao',
            'designation' => 'School librarian',
            'location' => null,
            'content' => 'Lovely editions, quick delivery.',
            'rating' => 4,
        ])->assertOk();

        $row = collect($this->getJson('/api/v1/testimonials')->assertOk()->json('data'))->firstWhere('id', $id);
        $this->assertSame('School librarian', $row['designation']);
        $this->assertNull($row['location']);
        $this->assertSame(4, (int) $row['rating']);
        $this->assertTrue(Testimonial::find($id)->is_active);
    }

    public function test_the_recently_viewed_row_is_on_by_default_and_can_be_switched_off_or_renamed(): void
    {
        $this->assertSame('1', (string) $this->published()['home_recent_enabled']);
        $this->assertSame('Recently Viewed', $this->published()['home_recent_title']);

        $this->putJson('/api/v1/admin/settings', ['home_recent_enabled' => '0', 'home_recent_title' => 'Pick Up Where You Left Off'])->assertOk();
        Setting::flush();
        $this->assertSame('0', (string) $this->published()['home_recent_enabled']);
        $this->assertSame('Pick Up Where You Left Off', $this->published()['home_recent_title']);

        $this->putJson('/api/v1/admin/settings', ['home_recent_enabled' => 'maybe'])->assertStatus(422);
    }
}
