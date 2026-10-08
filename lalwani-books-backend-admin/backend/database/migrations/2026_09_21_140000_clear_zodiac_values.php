<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Lalwani Books International sells books, not perfumes keyed to a birth chart. The
 * astrology was taken off the storefront and the admin panel earlier; this
 * clears the data behind it.
 *
 * The columns and the zodiac_signs table stay so the change is reversible and
 * so nothing that still selects them breaks — only the values go. zodiac_sign
 * becomes nullable on the way, because NOT NULL would otherwise force every
 * row to carry an empty string that reads like a real value in API payloads.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('zodiac_sign', 20)->nullable()->change();
        });

        DB::table('products')->update(['zodiac_sign' => null, 'sign_dates' => null]);

        // The twelve rashi rows and their admin overrides.
        DB::table('zodiac_signs')->delete();
    }

    public function down(): void
    {
        // The sign each product carried is not recoverable from anything left
        // in the schema, so a rollback restores the constraint, not the data.
        DB::table('products')->whereNull('zodiac_sign')->update(['zodiac_sign' => '']);

        Schema::table('products', function (Blueprint $table) {
            $table->string('zodiac_sign', 20)->nullable(false)->change();
        });
    }
};
