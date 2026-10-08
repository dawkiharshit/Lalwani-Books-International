<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_returns', function (Blueprint $table) {
            // How the customer wants a COD refund: 'upi' or 'bank'.
            $table->string('refund_method', 10)->nullable()->after('refund_upi');
            // Bank details when they pick bank: {account_name, account_number, ifsc, bank_name}.
            $table->json('refund_bank')->nullable()->after('refund_method');
        });
    }

    public function down(): void
    {
        Schema::table('order_returns', function (Blueprint $table) {
            $table->dropColumn(['refund_method', 'refund_bank']);
        });
    }
};
