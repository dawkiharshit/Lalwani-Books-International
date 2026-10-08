<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * A hero banner carries up to three covers; the storefront fans them out.
 *
 * Runs inside a rolled-back transaction, so it needs an already-migrated
 * database (the default in-memory SQLite has no tables), e.g.:
 *   DB_CONNECTION=mysql DB_DATABASE=lalwani_books_test php artisan test --filter=BannerCoversTest
 */
class BannerCoversTest extends TestCase
{
    use DatabaseTransactions;

    public function test_three_covers_are_saved_shown_publicly_and_can_be_removed_one_at_a_time(): void
    {
        Storage::fake('public');
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));

        $created = $this->post('/api/v1/admin/banners', [
            'title' => 'Covers test',
            'is_active' => '1',
            'image' => UploadedFile::fake()->image('front.jpg', 600, 840),
            'image_2' => UploadedFile::fake()->image('left.jpg', 600, 840),
            'image_3' => UploadedFile::fake()->image('right.jpg', 600, 840),
        ], ['Accept' => 'application/json'])->assertCreated()->json('data');

        $this->assertCount(3, array_filter($created['covers']));
        $this->assertSame($created['covers'][0], $created['image'], 'the front cover doubles as the legacy image');

        // The storefront gets the same three slots.
        $public = collect($this->getJson('/api/v1/banners')->assertOk()->json('data'))->firstWhere('id', $created['id']);
        $this->assertCount(3, array_filter($public['covers']));

        // Replace the front, remove the right; the left stays untouched.
        $updated = $this->post("/api/v1/admin/banners/{$created['id']}", [
            'image' => UploadedFile::fake()->image('front-2.jpg', 600, 840),
            'remove_image_3' => '1',
        ], ['Accept' => 'application/json'])->assertOk()->json('data');

        $this->assertNotSame($created['covers'][0], $updated['covers'][0]);
        $this->assertSame($created['covers'][1], $updated['covers'][1]);
        $this->assertNull($updated['covers'][2]);
        $this->assertSame('Covers test', $updated['title'], 'a cover-only update leaves the copy alone');
    }
}
