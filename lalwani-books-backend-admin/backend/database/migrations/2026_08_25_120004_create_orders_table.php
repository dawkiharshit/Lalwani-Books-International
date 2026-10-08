<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('order_number', 30)->unique();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('email');
            $table->string('status', 20)->default('pending')->index();
            $table->string('payment_method', 20)->default('cod');
            $table->string('payment_status', 20)->default('pending');
            $table->decimal('subtotal', 10, 2);
            $table->decimal('discount', 10, 2)->default(0);
            $table->decimal('shipping', 10, 2)->default(0);
            $table->decimal('tax', 10, 2)->default(0);
            $table->decimal('total', 10, 2);
            $table->string('coupon_code', 40)->nullable();
            $table->string('ship_name');
            $table->string('ship_phone', 30);
            $table->string('ship_address1');
            $table->string('ship_address2')->nullable();
            $table->string('ship_city');
            $table->string('ship_state');
            $table->string('ship_zip', 20);
            $table->string('ship_country', 60)->default('United States');
            $table->text('notes')->nullable();
            $table->timestamp('placed_at')->useCurrent();
            $table->timestamps();
            $table->index(['email', 'order_number']);
        });

        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->decimal('unit_price', 8, 2);
            $table->unsignedSmallInteger('quantity');
            $table->decimal('total', 10, 2);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
    }
};
