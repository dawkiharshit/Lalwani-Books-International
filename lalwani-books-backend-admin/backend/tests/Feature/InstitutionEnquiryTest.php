<?php

namespace Tests\Feature;

use App\Models\ContactMessage;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * Books for Institutions → Request a quote.
 *
 * Runs inside a rolled-back transaction, so it needs an already-migrated
 * database (the default in-memory SQLite has no tables), e.g.:
 *   DB_CONNECTION=mysql DB_DATABASE=lalwani_books_test php artisan test --filter=InstitutionEnquiryTest
 */
class InstitutionEnquiryTest extends TestCase
{
    use DatabaseTransactions;

    private function enquiry(array $override = []): array
    {
        return $override + [
            'name' => 'Meera Nair',
            'organisation' => 'Green Valley Public School',
            'type' => 'school',
            'email' => 'library@greenvalley.example',
            'phone' => '011-2345 6789',
            'city' => 'New Delhi',
            'quantity' => '200-1000',
            'requirements' => "NCERT class 6–8 sets, 40 copies each.\nPlus 100 story books for the library.",
        ];
    }

    public function test_a_quote_request_reaches_admin_messages(): void
    {
        $this->postJson('/api/v1/institution-enquiries', $this->enquiry())
            ->assertCreated()
            ->assertJsonPath('message', 'Thank you. We have your request and will get back to you with a quote within 24 hours.');

        $saved = ContactMessage::query()->latest('id')->first();
        $this->assertSame('Quote request: Green Valley Public School (School)', $saved->subject);
        $this->assertSame('library@greenvalley.example', $saved->email);
        foreach (['Phone: 011-2345 6789', 'City: New Delhi', '200 – 1,000 books', 'NCERT class 6–8 sets'] as $part) {
            $this->assertStringContainsString($part, $saved->message);
        }
    }

    public function test_nothing_is_demanded_except_a_way_to_reply(): void
    {
        // An empty form only misses the one thing a quote needs.
        $this->postJson('/api/v1/institution-enquiries', [])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Leave us an email address or a phone number, so we can send you the quote.');

        // A phone number on its own is enough, and so is an email on its own.
        $this->postJson('/api/v1/institution-enquiries', ['phone' => '9811000000'])->assertCreated();
        $this->postJson('/api/v1/institution-enquiries', ['email' => 'someone@example.test'])->assertCreated();

        $saved = ContactMessage::query()->latest('id')->first();
        $this->assertSame('Quote request: Books for Institutions', $saved->subject);
        $this->assertSame('Not given', $saved->name);
        $this->assertStringContainsString('Email: someone@example.test', $saved->message);
        // Nothing is written down that was never given.
        $this->assertStringNotContainsString('Phone:', $saved->message);
        $this->assertStringNotContainsString('Organisation:', $saved->message);
    }

    public function test_some_of_the_form_is_enough(): void
    {
        $this->postJson('/api/v1/institution-enquiries', [
            'organisation' => 'Sunrise Library',
            'email' => 'orders@sunrise.example',
        ])->assertCreated();

        $saved = ContactMessage::query()->latest('id')->first();
        $this->assertSame('Quote request: Sunrise Library', $saved->subject);
        $this->assertSame('Sunrise Library', $saved->name);
    }

    public function test_a_phone_number_given_must_be_callable(): void
    {
        foreach (['12345', 'call me maybe', '+91 98765 43210 12345'] as $bad) {
            $this->postJson('/api/v1/institution-enquiries', $this->enquiry(['phone' => $bad]))
                ->assertStatus(422)
                ->assertJsonValidationErrors('phone');
        }
        $this->postJson('/api/v1/institution-enquiries', $this->enquiry(['phone' => '+91 98765 43210']))->assertCreated();
    }

    public function test_only_known_organisation_types_and_quantities(): void
    {
        $this->postJson('/api/v1/institution-enquiries', $this->enquiry(['type' => 'hacker', 'quantity' => 'lots']))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['type', 'quantity']);
    }

    public function test_a_bot_filling_the_hidden_field_is_thanked_but_not_stored(): void
    {
        $before = ContactMessage::count();

        $this->postJson('/api/v1/institution-enquiries', $this->enquiry(['website' => 'https://spam.example']))->assertCreated();

        $this->assertSame($before, ContactMessage::count());
    }
}
