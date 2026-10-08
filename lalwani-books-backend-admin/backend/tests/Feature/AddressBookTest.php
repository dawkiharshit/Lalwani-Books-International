<?php

namespace Tests\Feature;

use App\Models\Address;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Runs inside a rolled-back transaction, so it needs an already-migrated
 * database (the default in-memory SQLite has no tables), e.g.:
 *   DB_CONNECTION=mysql DB_DATABASE=lalwani_books_test php artisan test --filter=AddressBookTest
 */
class AddressBookTest extends TestCase
{
    use DatabaseTransactions;

    private function payload(array $overrides = []): array
    {
        return $overrides + [
            'name' => 'Asha Rao',
            'phone' => '98765 43210',
            'address1' => '12 MG Road',
            'city' => 'Bengaluru',
            'state' => 'Karnataka',
            'zip' => '560001',
        ];
    }

    private function order(User $user, array $overrides = []): Order
    {
        return Order::create($overrides + [
            'order_number' => 'LBI-TEST-'.uniqid(),
            'user_id' => $user->id,
            'email' => $user->email,
            'status' => 'pending',
            'payment_method' => 'cod',
            'payment_status' => 'pending',
            'subtotal' => 100, 'discount' => 0, 'shipping' => 0, 'tax' => 18, 'total' => 118,
            'ship_name' => 'Asha Rao',
            'ship_phone' => '9876543210',
            'ship_address1' => '12 MG Road',
            'ship_city' => 'Bengaluru',
            'ship_state' => 'Karnataka',
            'ship_zip' => '560001',
            'ship_country' => 'India',
            'placed_at' => now(),
        ]);
    }

    public function test_first_order_address_is_remembered_as_default_and_not_duplicated(): void
    {
        $user = User::factory()->create();

        Address::rememberFromOrder($this->order($user));
        // Same place typed slightly differently is not a second address.
        Address::rememberFromOrder($this->order($user, ['ship_address1' => '12  mg road ', 'ship_phone' => '98765-43210']));

        $this->assertSame(1, $user->addresses()->count());
        $this->assertTrue($user->addresses()->first()->is_default);

        // A genuinely new address is saved, but doesn't steal the default.
        Address::rememberFromOrder($this->order($user, ['ship_address1' => '4 Park Street', 'ship_zip' => '700016']));
        $this->assertSame(2, $user->addresses()->count());
        $this->assertSame(1, $user->addresses()->where('is_default', true)->count());
    }

    public function test_customer_can_add_edit_default_and_delete_addresses(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $first = $this->postJson('/api/v1/addresses', $this->payload())->assertCreated()->json('data.0');
        $this->assertTrue($first['is_default']);

        $list = $this->postJson('/api/v1/addresses', $this->payload(['address1' => '4 Park Street', 'label' => 'Work']))
            ->assertCreated()->json('data');
        $second = collect($list)->firstWhere('label', 'Work');
        $this->assertFalse($second['is_default']);

        $this->putJson("/api/v1/addresses/{$second['id']}", $this->payload(['address1' => '5 Park Street', 'label' => 'Work']))
            ->assertOk()
            ->assertJsonFragment(['address1' => '5 Park Street']);

        $this->postJson("/api/v1/addresses/{$second['id']}/default")->assertOk()
            ->assertJsonPath('data.0.id', $second['id']);

        // Deleting the default hands it to the one that's left.
        $this->deleteJson("/api/v1/addresses/{$second['id']}")->assertOk()
            ->assertJsonPath('data.0.id', $first['id'])
            ->assertJsonPath('data.0.is_default', true);
    }

    public function test_rejects_bad_input_and_other_peoples_addresses(): void
    {
        $owner = User::factory()->create();
        $address = $owner->addresses()->create($this->payload(['country' => 'India']));

        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/v1/addresses', $this->payload(['phone' => '12345', 'zip' => '5600']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['phone', 'zip']);

        $this->putJson("/api/v1/addresses/{$address->id}", $this->payload())->assertNotFound();
        $this->deleteJson("/api/v1/addresses/{$address->id}")->assertNotFound();
        $this->assertDatabaseHas('addresses', ['id' => $address->id]);
    }

    public function test_guests_cannot_reach_the_address_book(): void
    {
        $this->getJson('/api/v1/addresses')->assertUnauthorized();
    }
}
