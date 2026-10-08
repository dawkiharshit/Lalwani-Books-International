<?php

namespace Tests\Feature;

use App\Models\Author;
use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Authors are records: created in admin, chosen on a book, shown on the site.
 *
 * Runs inside a rolled-back transaction, so it needs an already-migrated
 * database (the default in-memory SQLite has no tables), e.g.:
 *   DB_CONNECTION=mysql DB_DATABASE=lalwani_books_test php artisan test --filter=AuthorsTest
 */
class AuthorsTest extends TestCase
{
    use DatabaseTransactions;

    private function book(array $extra): array
    {
        $category = Category::first() ?? Category::create(['name' => 'Test Shelf', 'slug' => 'test-shelf-'.uniqid()]);

        return $extra + [
            'category_id' => $category->id,
            'name' => 'Author Test Book '.uniqid(),
            'description' => 'A book made by the authors test.',
            'price' => 199,
            'stock' => 3,
            'color_from' => '#F65D4E',
            'color_to' => '#C2410C',
            'accent' => '#FDE68A',
        ];
    }

    public function test_an_author_created_in_admin_is_chosen_on_a_book_and_shown_on_the_site(): void
    {
        Storage::fake('public');
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));

        $name = 'Test Writer '.uniqid();
        $author = $this->post('/api/v1/admin/authors', [
            'name' => $name,
            'bio' => 'Writes test books.',
            'photo' => UploadedFile::fake()->image('writer.jpg', 600, 600),
        ], ['Accept' => 'application/json'])->assertCreated()->json('data');

        $this->assertStringStartsWith('/storage/authors/', $author['photo']);
        $this->assertSame(0, $author['products_count']);

        // Pick the author on a book: the book's printed name follows the record.
        $id = $this->postJson('/api/v1/admin/products', $this->book(['author_id' => $author['id']]))->assertCreated()->json('data.id');
        $product = Product::find($id);
        $this->assertSame($author['id'], $product->author_id);
        $this->assertSame($name, $product->author);

        // The storefront sees the author, their count and their shelf.
        $public = collect($this->getJson('/api/v1/authors')->assertOk()->json('data'))->firstWhere('id', $author['id']);
        $this->assertSame(1, $public['products_count']);
        $this->assertSame($author['photo'], $public['photo']);
        $shelf = $this->getJson('/api/v1/products?author='.$author['slug'])->assertOk()->json('data');
        $this->assertSame([$id], array_column($shelf, 'id'));

        // Renaming the author renames them on every book.
        $this->post("/api/v1/admin/authors/{$author['id']}", ['name' => $name.' Jr'], ['Accept' => 'application/json'])->assertOk();
        $this->assertSame($name.' Jr', Product::find($id)->author);

        // With books, the author cannot be deleted; move the book first.
        $this->deleteJson("/api/v1/admin/authors/{$author['id']}")->assertStatus(422);
        $this->putJson("/api/v1/admin/products/{$id}", $this->book(['author_id' => null]))->assertOk();
        $this->assertNull(Product::find($id)->author);
        $this->deleteJson("/api/v1/admin/authors/{$author['id']}")->assertOk();
        $this->assertNull(Author::find($author['id']));
    }

    public function test_a_typed_author_name_is_filed_under_an_author_record(): void
    {
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));

        $name = 'Typed Writer '.uniqid();
        $id = $this->postJson('/api/v1/admin/products', $this->book(['author' => $name]))->assertCreated()->json('data.id');

        $author = Author::where('name', $name)->first();
        $this->assertNotNull($author, 'a free-text author should become an author record');
        $this->assertSame($author->id, Product::find($id)->author_id);

        // The same name again reuses the record rather than duplicating it.
        $this->postJson('/api/v1/admin/products', $this->book(['author' => $name]))->assertCreated();
        $this->assertSame(1, Author::where('name', $name)->count());
    }
}
