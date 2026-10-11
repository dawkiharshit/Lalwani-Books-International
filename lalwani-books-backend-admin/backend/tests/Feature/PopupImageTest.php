<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The picture in the newsletter popup (admin → Popup Banner): uploaded,
 * offered to the shop, removed — and only real images are accepted.
 *
 * Runs inside a rolled-back transaction, so it needs an already-migrated
 * database (the default in-memory SQLite has no tables), e.g.:
 *   DB_CONNECTION=mysql DB_DATABASE=lalwani_books_test php artisan test --filter=PopupImageTest
 */
class PopupImageTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));
    }

    public function test_an_uploaded_popup_image_reaches_the_shop_and_can_be_removed(): void
    {
        $path = $this->post('/api/v1/admin/settings/image/popup_image', [
            'file' => UploadedFile::fake()->image('poster.jpg', 800, 600),
        ], ['Accept' => 'application/json'])->assertOk()->json('data.popup_image');

        $this->assertStringStartsWith('/storage/popup/', $path);
        Storage::disk('public')->assertExists(substr($path, strlen('/storage/')));
        $this->getJson('/api/v1/settings')->assertOk()->assertJsonPath('data.popup_image', $path);

        $this->deleteJson('/api/v1/admin/settings/image/popup_image')->assertOk()->assertJsonPath('data.popup_image', '');
        Storage::disk('public')->assertMissing(substr($path, strlen('/storage/')));
        $this->getJson('/api/v1/settings')->assertJsonPath('data.popup_image', '');
    }

    public function test_only_images_are_accepted(): void
    {
        $this->post('/api/v1/admin/settings/image/popup_image', [
            'file' => UploadedFile::fake()->create('not-a-picture.php', 10, 'application/x-php'),
        ], ['Accept' => 'application/json'])->assertStatus(422);
    }

    public function test_shoppers_cannot_upload(): void
    {
        Sanctum::actingAs(User::factory()->create(['is_admin' => false]));

        $this->post('/api/v1/admin/settings/image/popup_image', [
            'file' => UploadedFile::fake()->image('poster.jpg'),
        ], ['Accept' => 'application/json'])->assertForbidden();
    }
}
