<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use App\Support\YouTube;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * A book's video link: every common YouTube link shape is understood, a link
 * that is not a YouTube video is refused with a reason (it used to save and
 * then never play), and an old bad link never hides an uploaded video.
 *
 *   DB_CONNECTION=mysql DB_DATABASE=lalwani_books_test php artisan test --filter=ProductVideoLinkTest
 */
class ProductVideoLinkTest extends TestCase
{
    use DatabaseTransactions;

    public function test_every_common_youtube_link_shape_gives_the_video_id(): void
    {
        foreach ([
            'https://www.youtube.com/watch?v=DABVeOpXs7w',
            'https://youtube.com/watch?si=abc123&v=DABVeOpXs7w&t=42',
            'https://m.youtube.com/watch?v=DABVeOpXs7w',
            'https://youtu.be/DABVeOpXs7w?si=Xyz',
            'https://www.youtube.com/shorts/DABVeOpXs7w',
            'https://www.youtube.com/live/DABVeOpXs7w?feature=share',
            'https://www.youtube.com/embed/DABVeOpXs7w',
            'https://www.youtube-nocookie.com/embed/DABVeOpXs7w',
            'youtu.be/DABVeOpXs7w',
        ] as $link) {
            $this->assertSame('DABVeOpXs7w', YouTube::id($link), $link);
        }

        foreach (['https://vimeo.com/123456', 'https://drive.google.com/file/d/abc/view', 'https://www.youtube.com/@lalwani', 'https://youtube.com.evil.example/watch?v=DABVeOpXs7w', ''] as $link) {
            $this->assertNull(YouTube::id($link), $link);
        }
    }

    private function payload(array $extra): array
    {
        $category = Category::first() ?? Category::create(['name' => 'Test Shelf', 'slug' => 'test-shelf-'.uniqid()]);

        return $extra + [
            'category_id' => $category->id,
            'name' => 'Video Test Book '.uniqid(),
            'description' => 'A book made by the video link test.',
            'price' => 199,
            'stock' => 3,
            'color_from' => '#042B52',
            'color_to' => '#0D4377',
            'accent' => '#E8B04B',
        ];
    }

    public function test_the_form_refuses_a_link_that_is_not_a_youtube_video(): void
    {
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));

        $this->postJson('/api/v1/admin/products', $this->payload(['video_url' => 'https://vimeo.com/123456']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('video_url');

        $id = $this->postJson('/api/v1/admin/products', $this->payload(['video_url' => 'https://youtu.be/DABVeOpXs7w?si=share']))
            ->assertCreated()
            ->json('data.id');
        $slug = Product::find($id)->slug;
        $this->assertSame('youtube', $this->getJson("/api/v1/products/{$slug}")->json('data.video.type'));
    }

    public function test_an_old_bad_link_never_hides_an_uploaded_video(): void
    {
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));
        $id = $this->postJson('/api/v1/admin/products', $this->payload([]))->assertCreated()->json('data.id');
        $product = Product::find($id);
        // As saved before links were checked.
        $product->forceFill(['video_url' => 'https://vimeo.com/123456', 'video_path' => 'storage/products/videos/clip.mp4'])->save();

        $video = $this->getJson("/api/v1/products/{$product->slug}")->assertOk()->json('data.video');
        $this->assertSame(['type' => 'file', 'url' => '/storage/products/videos/clip.mp4'], $video);
    }
}
