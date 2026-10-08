<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // Starts the 7-day return clock; set when the order is marked delivered.
            $table->timestamp('delivered_at')->nullable()->after('shipped_at');
        });

        // "returns" is a reserved word, so the table is order_returns.
        Schema::create('order_returns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type', 20);               // refund | replacement
            $table->string('reason', 80);             // Damaged, Wrong item, …
            $table->text('note')->nullable();          // customer's description
            $table->json('items');                     // [{name, quantity, product_id}]
            $table->json('photos')->nullable();        // ["/storage/returns/…"]
            $table->string('status', 20)->default('requested'); // requested|approved|rejected|completed
            $table->text('admin_note')->nullable();
            // Shiprocket reverse pickup
            $table->string('sr_return_order_id', 64)->nullable();
            $table->string('sr_return_shipment_id', 64)->nullable();
            $table->string('return_awb', 64)->nullable();
            // Resolution
            $table->string('refund_id', 64)->nullable();
            $table->decimal('refund_amount', 10, 2)->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_returns');
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('delivered_at');
        });
    }
};
