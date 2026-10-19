<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\Setting;
use App\Models\User;
use App\Support\StaffAccess;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Admin → Staff and Approvals: staff only open the areas the owner gave
 * them, and their saves wait for the owner's approval before going live.
 *
 * Runs inside a rolled-back transaction, so it needs an already-migrated
 * database with a product in it, e.g.:
 *   DB_CONNECTION=mysql DB_DATABASE=lalwani_books_test php artisan test --filter=StaffAccessTest
 */
class StaffAccessTest extends TestCase
{
    use DatabaseTransactions;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();

        Setting::flush();
        Http::preventStrayRequests();
        Mail::fake();
        Storage::fake('local');
        Storage::fake('public');
        $this->owner = User::factory()->create(['is_admin' => true]);
    }

    protected function tearDown(): void
    {
        Setting::flush();

        parent::tearDown();
    }

    /** A staff member with these areas, as the owner would add them. */
    private function staff(array $areas): User
    {
        Sanctum::actingAs($this->owner);
        $this->postJson('/api/v1/admin/staff', [
            'name' => 'Ravi Staff',
            'email' => 'ravi'.uniqid().'@example.test',
            'password' => 'counter-staff-42',
            'areas' => $areas,
        ])->assertCreated();

        $staff = User::where('name', 'Ravi Staff')->latest('id')->first();
        Sanctum::actingAs($staff);

        return $staff;
    }

    /** The whole product form, as the admin screen sends it, with some changes. */
    private function productForm(Product $product, array $changes): array
    {
        return array_merge([
            'category_id' => $product->category_id,
            'name' => $product->name,
            'slug' => $product->slug,
            'sku' => $product->sku,
            'description' => $product->description ?: 'A book.',
            'color_from' => $product->color_from ?: '#042b52',
            'color_to' => $product->color_to ?: '#0d4377',
            'accent' => $product->accent ?: '#e8b04b',
            'price' => (float) $product->price,
            'stock' => (int) $product->stock,
            'is_featured' => (bool) $product->is_featured,
            'is_new_arrival' => (bool) $product->is_new_arrival,
            'is_category_pick' => (bool) $product->is_category_pick,
            'is_bestseller' => (bool) $product->is_bestseller,
            'is_active' => (bool) $product->is_active,
        ], $changes);
    }

    public function test_the_owner_adds_staff_who_sign_in_with_only_their_areas(): void
    {
        $staff = $this->staff(['products' => 'approval', 'orders' => 'view']);

        $this->assertFalse((bool) $staff->is_admin);
        $login = $this->postJson('/api/v1/auth/login', ['email' => $staff->email, 'password' => 'counter-staff-42'])->assertOk();
        $login->assertJsonPath('user.is_admin', false)
            ->assertJsonPath('user.staff.areas.products', 'approval')
            ->assertJsonPath('user.staff.areas.orders', 'view')
            ->assertJsonPath('user.staff.areas.coupons', 'none');
    }

    public function test_staff_open_only_their_areas_and_never_the_owners_pages(): void
    {
        $this->staff(['products' => 'approval', 'orders' => 'view']);

        $this->getJson('/api/v1/admin/products')->assertOk();
        $this->getJson('/api/v1/admin/orders')->assertOk();
        // The lists every screen reads for its dropdowns.
        $this->getJson('/api/v1/admin/settings')->assertOk();
        $this->getJson('/api/v1/admin/categories')->assertOk();

        $this->getJson('/api/v1/admin/coupons')->assertForbidden()->assertJsonPath('message', "You don't have access to Coupons & Deals.");
        foreach (['/api/v1/admin/integrations/payment', '/api/v1/admin/whatsapp', '/api/v1/admin/staff', '/api/v1/admin/approvals'] as $ownerOnly) {
            $this->getJson($ownerOnly)->assertForbidden();
        }
        $this->putJson('/api/v1/admin/integrations/payment', ['razorpay_key_id' => 'rzp_live_stolen'])->assertForbidden();
        $this->postJson('/api/v1/admin/staff', ['name' => 'x', 'email' => 'x@example.test', 'password' => 'abcdefgh1'])->assertForbidden();

        // Orders is "view only".
        $order = \App\Models\Order::query()->first();
        if ($order) {
            $this->putJson("/api/v1/admin/orders/{$order->id}/status", ['status' => 'cancelled'])
                ->assertForbidden()
                ->assertJsonPath('message', 'You can look at Orders, but not change it.');
        }
    }

    public function test_a_staff_edit_waits_for_the_owner_then_goes_live(): void
    {
        $product = Product::query()->firstOrFail();
        $before = (float) $product->price;
        $staff = $this->staff(['products' => 'approval']);

        $this->putJson("/api/v1/admin/products/{$product->id}", $this->productForm($product, ['price' => $before + 11]))
            ->assertStatus(202)
            ->assertJsonPath('pending_approval', true);
        $this->assertEquals($before, (float) $product->fresh()->price, 'Nothing changes before approval.');

        // The owner sees what it would change.
        Sanctum::actingAs($this->owner);
        $waiting = $this->getJson('/api/v1/admin/approvals')->assertOk()->json('data');
        $this->assertCount(1, $waiting);
        $this->assertSame('Edit the product “'.$product->name.'”', $waiting[0]['title']);
        $this->assertSame('Ravi Staff', $waiting[0]['staff']['name']);
        // Only the price: the rest of the form is sent unchanged and left out.
        $this->assertCount(1, $waiting[0]['fields']);
        $this->assertSame('Price', $waiting[0]['fields'][0]['label']);
        $this->assertEquals($before, (float) $waiting[0]['fields'][0]['before']);
        $this->assertEquals($before + 11, (float) $waiting[0]['fields'][0]['after']);
        $this->getJson('/api/v1/admin/approvals/count')->assertJsonPath('data.pending', 1);

        // Staff can't approve their own change.
        Sanctum::actingAs($staff);
        $this->postJson("/api/v1/admin/approvals/{$waiting[0]['id']}/approve")->assertForbidden();

        Sanctum::actingAs($this->owner);
        $this->postJson("/api/v1/admin/approvals/{$waiting[0]['id']}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');
        $this->assertEquals($before + 11, (float) $product->fresh()->price);

        Sanctum::actingAs($staff);
        $this->getJson('/api/v1/admin/my-changes')->assertOk()->assertJsonPath('data.0.status', 'approved');
    }

    public function test_a_rejected_change_changes_nothing_and_says_why(): void
    {
        $product = Product::query()->firstOrFail();
        $this->staff(['products' => 'approval']);
        $this->putJson("/api/v1/admin/products/{$product->id}", $this->productForm($product, ['name' => 'Renamed by staff']))->assertStatus(202);

        Sanctum::actingAs($this->owner);
        $id = $this->getJson('/api/v1/admin/approvals')->json('data.0.id');
        $this->postJson("/api/v1/admin/approvals/{$id}/reject", ['reason' => 'Keep the original title.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'rejected');

        $this->assertSame($product->name, $product->fresh()->name);
        $this->getJson('/api/v1/admin/approvals?status=decided')->assertJsonPath('data.0.reason', 'Keep the original title.');
    }

    public function test_photos_wait_too_and_the_owner_can_look_at_them(): void
    {
        $product = Product::query()->firstOrFail();
        $this->staff(['products' => 'approval']);

        $this->post("/api/v1/admin/products/{$product->id}/image", ['file' => UploadedFile::fake()->image('cover.jpg', 400, 600)], ['Accept' => 'application/json'])
            ->assertStatus(202);
        $this->assertSame($product->image, $product->fresh()->image);

        Sanctum::actingAs($this->owner);
        $change = $this->getJson('/api/v1/admin/approvals')->json('data.0');
        $this->assertSame('Change the main photo of “'.$product->name.'”', $change['title']);
        $this->assertTrue($change['files'][0]['image']);
        $this->get("/api/v1/admin/approvals/{$change['id']}/files/0")->assertOk();

        $this->postJson("/api/v1/admin/approvals/{$change['id']}/approve")->assertOk();
        $this->assertNotSame($product->image, $product->fresh()->image);
    }

    public function test_an_area_set_to_direct_goes_live_at_once(): void
    {
        $this->staff(['coupons' => 'direct']);

        $this->postJson('/api/v1/admin/coupons', ['code' => 'STAFF10', 'type' => 'percent', 'value' => 10, 'is_active' => true])
            ->assertCreated();
        $this->assertDatabaseHas('coupons', ['code' => 'STAFF10']);
    }

    public function test_a_paused_staff_member_is_shut_out(): void
    {
        $staff = $this->staff(['products' => 'view']);

        Sanctum::actingAs($this->owner);
        $this->putJson("/api/v1/admin/staff/{$staff->id}", ['active' => false])->assertOk();

        Sanctum::actingAs($staff->fresh());
        $this->getJson('/api/v1/admin/products')->assertForbidden();
        $this->assertNull(StaffAccess::member($staff->fresh()));
    }

    public function test_an_existing_customer_cannot_be_made_staff_by_mistake(): void
    {
        $customer = User::factory()->create();
        Sanctum::actingAs($this->owner);

        $this->postJson('/api/v1/admin/staff', ['name' => 'X', 'email' => $customer->email, 'password' => 'counter-staff-42'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');
        $this->assertNull(StaffAccess::member($customer));
    }
}
