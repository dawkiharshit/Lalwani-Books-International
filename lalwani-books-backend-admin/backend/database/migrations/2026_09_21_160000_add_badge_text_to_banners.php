<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The offer flash on a hero slide — "UP TO 20% OFF", "FREE GIFT".
 *
 * It is its own column rather than part of the title so it can be styled as a
 * badge and, more importantly, cleared on its own: when a sale ends the shop
 * empties one field instead of rewriting the headline.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('banners', function (Blueprint $table) {
            $table->string('badge_text', 40)->nullable()->after('subtitle');
        });
    }

    public function down(): void
    {
        Schema::table('banners', function (Blueprint $table) {
            $table->dropColumn('badge_text');
        });
    }
};
