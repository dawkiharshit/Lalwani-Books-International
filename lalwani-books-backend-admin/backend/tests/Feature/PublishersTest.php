<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\Publisher;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Publishers are records: created in admin, chosen on a book, listed on the
 * storefront's Publications page with a shelf of their books.
 *
 * Runs inside a rolled-back transaction, so it needs an already-migrated
 * database (the default in-memory SQLite has no tables), e.g.:
 *   DB_CONNECTION=mysql DB_DATABASE=lalwani_books_test php artisan test --filter=PublishersTest
 */
class PublishersTest extends TestCase
{
    use DatabaseTransactions;

    private function book(array $extra): array
    {
        $category = Category::query()->firstOrFail();

        return $extra + [
            'category_id' => $category->id,
            'name' => 'Publisher Test Book '.uniqid(),
            'description' => 'A book made by the publishers test.',
            'price' => 199,
            'stock' => 3,
            'color_from' => '#F65D4E',
            'color_to' => '#C2410C',
            'accent' => '#FDE68A',
        ];
    }

    public function test_a_publisher_created_in_admin_is_chosen_on_a_book_and_shown_on_the_site(): void
    {
        Storage::fake('public');
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));

        $name = 'Test Press '.uniqid();
        $publisher = $this->post('/api/v1/admin/publishers', [
            'name' => $name,
            'description' => 'Publishes test books.',
            'logo' => UploadedFile::fake()->image('press.png', 400, 200),
        ], ['Accept' => 'application/json'])->assertCreated()->json('data');

        $this->assertStringStartsWith('/storage/publishers/', $publisher['logo']);
        $this->assertSame(0, $publisher['products_count']);

        // Pick the publisher on a book: the book's printed name follows the record.
        $id = $this->postJson('/api/v1/admin/products', $this->book(['publisher_id' => $publisher['id']]))->assertCreated()->json('data.id');
        $product = Product::find($id);
        $this->assertSame($publisher['id'], $product->publisher_id);
        $this->assertSame($name, $product->publisher);

        // The storefront sees the publisher, their count and their shelf.
        $public = collect($this->getJson('/api/v1/publishers')->assertOk()->json('data'))->firstWhere('id', $publisher['id']);
        $this->assertSame(1, $public['products_count']);
        $this->assertSame($publisher['logo'], $public['logo']);
        $shelf = $this->getJson('/api/v1/products?publisher='.$publisher['slug'])->assertOk()->json('data');
        $this->assertSame([$id], array_column($shelf, 'id'));

        // Renaming the publisher renames them on every book.
        $this->post("/api/v1/admin/publishers/{$publisher['id']}", ['name' => $name.' India'], ['Accept' => 'application/json'])->assertOk();
        $this->assertSame($name.' India', Product::find($id)->publisher);

        // The logo can be cleared without touching anything else.
        $this->deleteJson("/api/v1/admin/publishers/{$publisher['id']}/logo")->assertOk()->assertJsonPath('data.logo', null);

        // With books, the publisher cannot be deleted; move the book first.
        $this->deleteJson("/api/v1/admin/publishers/{$publisher['id']}")->assertStatus(422);
        $this->putJson("/api/v1/admin/products/{$id}", $this->book(['publisher_id' => null]))->assertOk();
        $this->assertNull(Product::find($id)->publisher);
        $this->deleteJson("/api/v1/admin/publishers/{$publisher['id']}")->assertOk();
        $this->assertNull(Publisher::find($publisher['id']));
    }

    public function test_the_publications_list_shows_a_few_of_each_publishers_live_books(): void
    {
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));

        $publisher = Publisher::create(['name' => 'Shelf Press '.uniqid(), 'slug' => 'shelf-press-'.uniqid()]);
        $ids = [];
        foreach (range(1, 4) as $n) {
            $ids[] = $this->postJson('/api/v1/admin/products', $this->book(['publisher_id' => $publisher->id]))->assertCreated()->json('data.id');
        }
        Product::whereIn('id', $ids)->update(['image' => 'storage/products/shelf-test.jpg', 'is_bestseller' => false, 'is_featured' => false]);
        Product::find($ids[0])->update(['is_bestseller' => true]);
        $hidden = $this->postJson('/api/v1/admin/products', $this->book(['publisher_id' => $publisher->id]))->assertCreated()->json('data.id');
        Product::find($hidden)->update(['is_active' => false]);

        $public = collect($this->getJson('/api/v1/publishers')->assertOk()->json('data'))->firstWhere('id', $publisher->id);
        $this->assertSame(4, $public['products_count']);

        // A few books, not the whole list: live ones only, bestsellers first, newest next.
        $books = $public['books'];
        $this->assertSame([$ids[0], $ids[3], $ids[2]], array_column($books, 'id'));
        $this->assertNotContains($hidden, array_column($books, 'id'));
        $this->assertSame('/storage/products/shelf-test.jpg', $books[0]['image']);
        $this->assertSame('#F65D4E', $books[0]['colors']['from']);
        $this->assertSame(Product::find($ids[0])->slug, $books[0]['slug']);

        // A publisher with no live books still appears, with an empty shelf.
        $empty = Publisher::create(['name' => 'Empty Press '.uniqid(), 'slug' => 'empty-press-'.uniqid()]);
        $public = collect($this->getJson('/api/v1/publishers')->assertOk()->json('data'))->firstWhere('id', $empty->id);
        $this->assertSame([], $public['books']);
    }

    public function test_a_typed_publisher_name_is_filed_under_a_publisher_record(): void
    {
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));

        $name = 'Typed Press '.uniqid();
        $id = $this->postJson('/api/v1/admin/products', $this->book(['publisher' => $name]))->assertCreated()->json('data.id');

        $publisher = Publisher::where('name', $name)->first();
        $this->assertNotNull($publisher, 'a free-text publisher should become a publisher record');
        $this->assertSame($publisher->id, Product::find($id)->publisher_id);

        // The same name again reuses the record rather than duplicating it.
        $this->postJson('/api/v1/admin/products', $this->book(['publisher' => $name]))->assertCreated();
        $this->assertSame(1, Publisher::where('name', $name)->count());
    }

    public function test_publisher_names_must_be_unique_and_logos_must_be_images(): void
    {
        Storage::fake('public');
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));

        $name = 'Unique Press '.uniqid();
        $this->postJson('/api/v1/admin/publishers', ['name' => $name])->assertCreated();
        $this->postJson('/api/v1/admin/publishers', ['name' => $name])
            ->assertUnprocessable()->assertJsonValidationErrors('name');
        $this->post('/api/v1/admin/publishers', [
            'name' => 'Logo Press '.uniqid(),
            'logo' => UploadedFile::fake()->create('logo.pdf', 50, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('logo');
    }

    public function test_customers_cannot_manage_publishers(): void
    {
        $this->postJson('/api/v1/admin/publishers', ['name' => 'x'])->assertUnauthorized();

        Sanctum::actingAs(User::factory()->create(['is_admin' => false]));
        $this->postJson('/api/v1/admin/publishers', ['name' => 'x'])->assertForbidden();
        $this->getJson('/api/v1/admin/publishers')->assertForbidden();
    }
}
