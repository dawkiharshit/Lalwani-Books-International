<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Extra photos added in the Photos panel must reach the shop's product page.
 *
 * Runs inside a rolled-back transaction, so it needs an already-migrated
 * database (the default in-memory SQLite has no tables), e.g.:
 *   DB_CONNECTION=mysql DB_DATABASE=lalwani_books_test php artisan test --filter=ProductGalleryTest
 */
class ProductGalleryTest extends TestCase
{
    use DatabaseTransactions;

    public function test_gallery_photos_are_stored_and_published_on_the_product(): void
    {
        Storage::fake('public');
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));

        $category = Category::first() ?? Category::create(['name' => 'Test Shelf', 'slug' => 'test-shelf-'.uniqid()]);
        $slug = 'gallery-book-'.uniqid();
        $id = $this->postJson('/api/v1/admin/products', [
            'category_id' => $category->id,
            'name' => 'Gallery Book '.uniqid(),
            'slug' => $slug,
            'author' => 'Test Author',
            'description' => 'A book made by the gallery test.',
            'price' => 250,
            'stock' => 5,
            'color_from' => '#F65D4E',
            'color_to' => '#C2410C',
            'accent' => '#FDE68A',
        ])->assertCreated()->json('data.id');

        // Two more photos, sent the way the Photos panel sends them (files[]).
        $response = $this->postJson("/api/v1/admin/products/{$id}/gallery", [
            'files' => [
                UploadedFile::fake()->image('back.jpg', 400, 560),
                UploadedFile::fake()->image('spine.webp', 400, 560),
            ],
        ])->assertCreated();
        $gallery = $response->json('data.gallery');
        $this->assertCount(2, $gallery);
        foreach ($gallery as $shot) {
            $this->assertStringContainsString('/storage/products/', $shot['url']);
            Storage::disk('public')->assertExists(substr(parse_url($shot['url'], PHP_URL_PATH), strlen('/storage/')));
        }

        // The shop reads the same list on the product page.
        $public = $this->getJson("/api/v1/products/{$slug}")->assertOk()->json('data');
        $this->assertCount(2, $public['gallery']);
        $this->assertSame($gallery[0]['url'], $public['gallery'][0]['url']);

        // Removing one leaves the other in place.
        $this->deleteJson("/api/v1/admin/products/{$id}/gallery/{$gallery[0]['id']}")->assertOk();
        $this->assertCount(1, $this->getJson("/api/v1/products/{$slug}")->json('data.gallery'));

        // A file that is not an image is refused with a clear validation error.
        $this->postJson("/api/v1/admin/products/{$id}/gallery", [
            'files' => [UploadedFile::fake()->create('notes.pdf', 100, 'application/pdf')],
        ])->assertUnprocessable();
    }
}
