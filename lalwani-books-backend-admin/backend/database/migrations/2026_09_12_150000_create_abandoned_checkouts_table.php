<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('abandoned_checkouts', function (Blueprint $table) {
            $table->id();
            // One row per checkout session. The cart token dedupes the pings a
            // shopper sends while typing, so the row updates in place instead of
            // piling up. Deleted the moment that session's order is placed.
            $table->string('cart_token', 64)->nullable()->unique();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('email')->nullable();
            $table->string('ship_name', 120)->nullable();
            $table->string('ship_phone', 30)->nullable();
            $table->string('ship_address1', 190)->nullable();
            $table->string('ship_city', 120)->nullable();
            $table->string('ship_state', 120)->nullable();
            $table->string('ship_zip', 20)->nullable();
            // What was in the bag when they left: [{name, quantity, price}].
            $table->json('cart_snapshot')->nullable();
            $table->decimal('subtotal', 10, 2)->default(0);
            $table->timestamps();
            $table->index('updated_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('abandoned_checkouts');
    }
};
