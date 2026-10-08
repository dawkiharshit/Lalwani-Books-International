<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Invoice numbers are assigned once and never reused. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('invoice_number', 40)->nullable()->unique()->after('order_number');
            $table->timestamp('invoiced_at')->nullable()->after('invoice_number');
            $table->timestamp('cancelled_at')->nullable()->after('invoiced_at');
            $table->string('cancel_reason', 190)->nullable()->after('cancelled_at');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['invoice_number', 'invoiced_at', 'cancelled_at', 'cancel_reason']);
        });
    }
};
