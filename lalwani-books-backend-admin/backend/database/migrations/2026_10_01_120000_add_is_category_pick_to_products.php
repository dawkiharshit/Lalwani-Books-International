<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Opts a product into the per-category rails on the home page.
 *
 * Separate from is_featured and is_new_arrival because it answers a different
 * question: those two pick a product out of the whole catalogue, this one picks
 * it out of its own category. The category itself is already on the row — this
 * only says whether the product should represent it on the home page.
 *
 * Indexed because the rails query it once per category.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->boolean('is_category_pick')->default(false)->after('is_new_arrival')->index();
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            // The index goes first: SQLite rebuilds the table to drop a column
            // and refuses while an index still points at it.
            $table->dropIndex(['is_category_pick']);
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('is_category_pick');
        });
    }
};
