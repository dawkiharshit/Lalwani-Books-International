<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Takes the astrology out of the schema. The previous migration emptied these;
 * nothing reads them any more, so the columns and the overrides table go too.
 *
 * zodiac_signs is dropped first because it holds the foreign key to products.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('zodiac_signs');

        Schema::table('products', function (Blueprint $table) {
            // SQLite refuses to drop a column an index still points at, and it
            // rebuilds the table on both statements, so the index goes first.
            $table->dropIndex('products_zodiac_sign_index');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['zodiac_sign', 'sign_dates']);
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('zodiac_sign', 20)->nullable()->index();
            $table->string('sign_dates', 40)->nullable();
        });

        // Structure only. The twelve rows and their admin overrides were
        // deleted before this migration ran and are not recoverable here.
        Schema::create('zodiac_signs', function (Blueprint $table) {
            $table->id();
            $table->string('sign', 20)->unique();
            $table->string('traits', 190)->nullable();
            $table->string('ruling_planet', 60)->nullable();
            $table->text('description')->nullable();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->timestamps();
        });
    }
};
