<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_returns', function (Blueprint $table) {
            // Where a COD refund is paid to — a UPI VPA or bank details the
            // customer gives, since there is no online payment to reverse.
            $table->string('refund_upi')->nullable()->after('refund_amount');
        });
    }

    public function down(): void
    {
        Schema::table('order_returns', function (Blueprint $table) {
            $table->dropColumn('refund_upi');
        });
    }
};
