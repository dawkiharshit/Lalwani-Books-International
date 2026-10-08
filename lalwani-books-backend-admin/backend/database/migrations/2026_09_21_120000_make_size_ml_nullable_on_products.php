<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The catalogue is no longer only bottles. A gift set or a hand-thrown honey
 * pot has no volume, and storing 0 there put a literal "0 ml" on the product
 * page. Null now means "not a measured product" and the UI omits the line.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->unsignedInteger('size_ml')->nullable()->change();
        });
    }

    public function down(): void
    {
        // Existing nulls would break a NOT NULL rebuild, so give them a value.
        \Illuminate\Support\Facades\DB::table('products')->whereNull('size_ml')->update(['size_ml' => 0]);

        Schema::table('products', function (Blueprint $table) {
            $table->unsignedInteger('size_ml')->nullable(false)->change();
        });
    }
};
