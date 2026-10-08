<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            // Required on an Indian tax invoice, per line.
            $table->string('hsn_code', 12)->nullable()->after('sku');

            // Grams, so a 30ml sample and a 100ml bottle are both exact and
            // there is no float drift when a courier weight is summed.
            $table->unsignedInteger('weight_grams')->nullable()->after('size_ml');

            // Null = fall back to the store-wide default.
            $table->unsignedSmallInteger('low_stock_threshold')->nullable()->after('stock');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['hsn_code', 'weight_grams', 'low_stock_threshold']);
        });
    }
};
