<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\Setting;
use App\Models\Testimonial;
use App\Models\User;
use App\Support\TestimonialPhotos;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Profile pictures: a customer uploads one in My account and it appears
 * beside their reviews; the admin gives each testimonial a photo (kept in
 * settings, since the live database takes no new columns).
 *
 *   DB_CONNECTION=mysql DB_DATABASE=lalwani_books_test php artisan test --filter=ProfilePhotoTest
 */
class ProfilePhotoTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        Setting::flush();
        $this->beforeApplicationDestroyed(fn () => Setting::flush());
    }

    private function product(): Product
    {
        $category = Category::first() ?? Category::create(['name' => 'Test Shelf', 'slug' => 'test-shelf-'.uniqid()]);

        return Product::create([
            'category_id' => $category->id,
            'name' => 'Photo Test Book '.uniqid(),
            'slug' => 'photo-test-book-'.uniqid(),
            'sku' => 'LBI-P'.strtoupper(substr(uniqid(), -5)),
            'description' => 'A book made by the profile photo test.',
            'price' => 199,
            'stock' => 3,
            'is_active' => true,
            'color_from' => '#042B52',
            'color_to' => '#0D4377',
            'accent' => '#E8B04B',
        ]);
    }

    public function test_a_customer_can_add_and_remove_their_profile_photo(): void
    {
        $user = User::factory()->create(['avatar' => null]);
        Sanctum::actingAs($user);

        $avatar = $this->post('/api/v1/auth/avatar', [
            'file' => UploadedFile::fake()->image('me.jpg', 400, 400),
        ], ['Accept' => 'application/json'])->assertOk()->json('user.avatar');

        // Root-relative, so the shop serves it from its own address.
        $this->assertStringStartsWith('/storage/avatars/', $avatar);
        Storage::disk('public')->assertExists(substr($avatar, strlen('/storage/')));
        $this->assertSame($avatar, $this->getJson('/api/v1/auth/me')->json('user.avatar'));

        // Removing it clears the account and deletes the file.
        $this->assertNull($this->deleteJson('/api/v1/auth/avatar')->assertOk()->json('user.avatar'));
        Storage::disk('public')->assertMissing(substr($avatar, strlen('/storage/')));
    }

    public function test_anything_that_is_not_a_picture_is_refused(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->post('/api/v1/auth/avatar', [
            'file' => UploadedFile::fake()->create('sneaky.php', 20, 'text/x-php'),
        ], ['Accept' => 'application/json'])->assertStatus(422)->assertJsonValidationErrors('file');

        $this->post('/api/v1/auth/avatar', [], ['Accept' => 'application/json'])->assertStatus(422);

        // A real picture sent under a script's name is stored under a random
        // name with a picture's extension, so the server never runs it.
        $saved = $this->post('/api/v1/auth/avatar', [
            'file' => UploadedFile::fake()->image('shell.php.jpg', 50, 50),
        ], ['Accept' => 'application/json'])->assertOk()->json('user.avatar');
        $this->assertMatchesRegularExpression('#^/storage/avatars/[A-Za-z0-9]{20,}\.(jpe?g|png|webp)$#', $saved);
        $this->assertStringNotContainsString('shell', $saved);
    }

    public function test_a_signed_in_customers_photo_shows_beside_their_review(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $avatar = $this->post('/api/v1/auth/avatar', [
            'file' => UploadedFile::fake()->image('me.png', 300, 300),
        ], ['Accept' => 'application/json'])->assertOk()->json('user.avatar');

        $product = $this->product();
        $mine = $this->postJson("/api/v1/products/{$product->slug}/reviews", [
            'name' => 'E2E Reader', 'rating' => 5, 'body' => 'A review by a signed-in customer.',
        ])->assertCreated()->json('data.id');

        // A guest's review, for contrast.
        $guest = $product->reviews()->create(['name' => 'Guest Reader', 'rating' => 4, 'body' => 'A review by a guest.', 'is_approved' => true]);
        $product->reviews()->whereKey($mine)->update(['is_approved' => true]);

        $shown = collect($this->getJson("/api/v1/products/{$product->slug}/reviews")->assertOk()->json('data'))->keyBy('id');
        $this->assertSame($avatar, $shown[$mine]['photo']);
        $this->assertNull($shown[$guest->id]['photo']);
    }

    public function test_a_google_sign_in_picture_is_not_shown_beside_reviews(): void
    {
        // Saved by Google sign-in, never chosen for public display.
        $user = User::factory()->create();
        $user->forceFill(['avatar' => 'https://lh3.googleusercontent.com/a/some-google-picture'])->save();
        Sanctum::actingAs($user);

        // Their own account still shows it to them.
        $this->assertSame('https://lh3.googleusercontent.com/a/some-google-picture', $this->getJson('/api/v1/auth/me')->json('user.avatar'));

        $product = $this->product();
        $id = $this->postJson("/api/v1/products/{$product->slug}/reviews", [
            'name' => 'Google Reader', 'rating' => 5, 'body' => 'A review by a Google sign-in.',
        ])->assertCreated()->json('data.id');
        $product->reviews()->whereKey($id)->update(['is_approved' => true]);

        $shown = collect($this->getJson("/api/v1/products/{$product->slug}/reviews")->json('data'))->firstWhere('id', $id);
        $this->assertNull($shown['photo']);
    }

    public function test_the_admin_gives_a_testimonial_a_photo_and_takes_it_off_again(): void
    {
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));
        $fields = ['name' => 'Happy Reader', 'content' => 'Lovely books, quick delivery.', 'rating' => 5];

        $created = $this->post('/api/v1/admin/testimonials', $fields + [
            'photo' => UploadedFile::fake()->image('reader.jpg', 300, 300),
        ], ['Accept' => 'application/json'])->assertCreated()->json('data');

        $this->assertStringStartsWith('/storage/testimonials/', $created['photo']);
        Storage::disk('public')->assertExists(substr($created['photo'], strlen('/storage/')));

        // The storefront sees the same photo.
        $public = collect($this->getJson('/api/v1/testimonials')->assertOk()->json('data'))->firstWhere('id', $created['id']);
        $this->assertSame($created['photo'], $public['photo']);

        // Saving the wording again, with no new file, keeps the photo.
        $kept = $this->post("/api/v1/admin/testimonials/{$created['id']}", $fields + ['content' => 'Reworded.'], ['Accept' => 'application/json'])
            ->assertOk()->json('data');
        $this->assertSame($created['photo'], $kept['photo']);

        // Removing it clears the photo and deletes the file.
        $this->assertNull($this->deleteJson("/api/v1/admin/testimonials/{$created['id']}/photo")->assertOk()->json('data.photo'));
        Storage::disk('public')->assertMissing(substr($created['photo'], strlen('/storage/')));
        $this->assertNull(TestimonialPhotos::get($created['id']));
    }

    public function test_deleting_a_testimonial_takes_its_photo_with_it(): void
    {
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));
        $created = $this->post('/api/v1/admin/testimonials', [
            'name' => 'Gone Reader', 'content' => 'This one gets deleted.', 'rating' => 4,
            'photo' => UploadedFile::fake()->image('gone.jpg', 200, 200),
        ], ['Accept' => 'application/json'])->assertCreated()->json('data');

        $this->deleteJson("/api/v1/admin/testimonials/{$created['id']}")->assertOk();

        Storage::disk('public')->assertMissing(substr($created['photo'], strlen('/storage/')));
        $this->assertNull(TestimonialPhotos::get($created['id']));
        $this->assertNull(Testimonial::find($created['id']));
    }
}
