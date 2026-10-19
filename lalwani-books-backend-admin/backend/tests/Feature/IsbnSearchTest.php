<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\User;
use App\Support\Isbn;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * ISBNs on the book cards and in the search bar: typed with or without
 * dashes, and in either form — the 10-digit ISBN finds a book saved with its
 * 13-digit one, and the other way round.
 *
 *   DB_CONNECTION=mysql DB_DATABASE=lalwani_books_test php artisan test --filter=IsbnSearchTest
 */
class IsbnSearchTest extends TestCase
{
    use DatabaseTransactions;

    /** A valid ISBN-13 no other test book uses. */
    private function freshIsbn(): string
    {
        $core = '978'.str_pad((string) random_int(0, 999999999), 9, '0', STR_PAD_LEFT);
        $sum = 0;
        for ($i = 0; $i < 12; $i++) {
            $sum += (int) $core[$i] * ($i % 2 ? 3 : 1);
        }

        return $core.((10 - $sum % 10) % 10);
    }

    private function book(string $isbn): int
    {
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));
        $category = Category::first() ?? Category::create(['name' => 'Test Shelf', 'slug' => 'test-shelf-'.uniqid()]);

        return $this->postJson('/api/v1/admin/products', [
            'category_id' => $category->id,
            'name' => 'ISBN Test Book '.uniqid(),
            'isbn' => $isbn,
            'description' => 'A book made by the ISBN test.',
            'price' => 199,
            'stock' => 3,
            'color_from' => '#042B52',
            'color_to' => '#0D4377',
            'accent' => '#E8B04B',
        ])->assertCreated()->json('data.id');
    }

    public function test_the_two_forms_of_an_isbn_convert_both_ways(): void
    {
        // Clean Code: 0-13-235088-2 / 978-0-13-235088-4.
        $this->assertSame('9780132350884', Isbn::toThirteen('0132350882'));
        $this->assertSame('0132350882', Isbn::toTen('9780132350884'));
        $this->assertSame(['0132350882', '9780132350884'], Isbn::variants('0132350882'));
        $this->assertSame(['9780132350884', '0132350882'], Isbn::variants('9780132350884'));
        // A mistyped ISBN is searched as typed, with no second form.
        $this->assertSame(['0132350883'], Isbn::variants('0132350883'));
        $this->assertSame('9780132350884', Isbn::digits('978-0-13 235088-4'));
    }

    public function test_cards_carry_the_isbn_and_either_form_finds_the_book(): void
    {
        $isbn = $this->freshIsbn();
        $dashed = substr($isbn, 0, 3).'-'.substr($isbn, 3, 1).'-'.substr($isbn, 4, 4).'-'.substr($isbn, 8, 4).'-'.substr($isbn, 12);
        $id = $this->book($dashed);
        $ten = Isbn::toTen($isbn);

        // The card shows the ISBN as saved.
        $card = $this->getJson("/api/v1/products?ids={$id}")->assertOk()->json('data.0');
        $this->assertSame($dashed, $card['isbn']);

        // The search bar's results: 13 digits plain, the dashed form, and the 10-digit form.
        foreach ([$isbn, $dashed, $ten] as $typed) {
            $found = array_column($this->getJson('/api/v1/products?search='.urlencode($typed))->assertOk()->json('data'), 'id');
            $this->assertContains($id, $found, "search for {$typed}");
        }

        // The suggestions' ISBN group too, from the 10-digit form.
        $suggested = array_column($this->getJson('/api/v1/search/suggest?q='.$ten)->assertOk()->json('data.isbn'), 'isbn');
        $this->assertContains($dashed, $suggested);
    }
}
