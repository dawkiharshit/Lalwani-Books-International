<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Saving the product form must never wipe a photo uploaded a moment earlier.
 *
 * Runs inside a rolled-back transaction, so it needs an already-migrated
 * database (the default in-memory SQLite has no tables), e.g.:
 *   DB_CONNECTION=mysql DB_DATABASE=lalwani_books_test php artisan test --filter=ProductPhotoKeptTest
 */
class ProductPhotoKeptTest extends TestCase
{
    use DatabaseTransactions;

    public function test_saving_the_form_with_a_blank_image_keeps_the_uploaded_photo(): void
    {
        Storage::fake('public');
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));

        $category = Category::first() ?? Category::create(['name' => 'Test Shelf', 'slug' => 'test-shelf-'.uniqid()]);
        $book = [
            'category_id' => $category->id,
            'name' => 'Photo Keep '.uniqid(),
            'author' => 'Test Author',
            'description' => 'A book made by the photo test.',
            'price' => 250,
            'stock' => 5,
            'color_from' => '#F65D4E',
            'color_to' => '#C2410C',
            'accent' => '#FDE68A',
        ];
        // Created the way the admin screen creates it, so every column the
        // form fills is filled here too.
        $id = $this->postJson('/api/v1/admin/products', $book)->assertCreated()->json('data.id');

        // Upload a cover through the Photos panel's endpoint.
        $this->postJson("/api/v1/admin/products/{$id}/image", [
            'file' => UploadedFile::fake()->image('cover.jpg', 400, 560),
        ])->assertCreated();
        $uploaded = Product::find($id)->image;
        $this->assertStringStartsWith('storage/products/', $uploaded);

        // Then save the form exactly as the edit screen used to — with the
        // image field blank — and the photo must still be there.
        $this->putJson("/api/v1/admin/products/{$id}", array_merge($book, ['image' => null, 'price' => 275]))->assertOk();

        $fresh = Product::find($id);
        $this->assertSame($uploaded, $fresh->image, 'the uploaded photo was wiped by saving the form');
        $this->assertSame(275.0, (float) $fresh->price);

        // A form still holding the path from before a re-upload must not point
        // the book back at that old (now deleted) file either.
        $this->putJson("/api/v1/admin/products/{$id}", array_merge($book, ['image' => '/storage/products/stale-old-cover.webp']))->assertOk();
        $this->assertSame($uploaded, Product::find($id)->image, 'a stale image path from the form overwrote the photo');

        // Only the dedicated remove endpoint clears it.
        $this->deleteJson("/api/v1/admin/products/{$id}/image")->assertOk();
        $this->assertNull(Product::find($id)->image);
    }
}
