<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Drops the category element.
 *
 * It was the four-element collection scheme (Fire/Earth/Air/Water) that
 * 2026_08_27_140000 reshaped into rashis and the store then moved past again.
 * By the time it went, six of the seven rows held their own slug in the field
 * — skin, hair, makeup, fragrance, bath-body, gifting — and the seventh still
 * said 'earth'. Nothing read it that a visitor could see.
 *
 * It could not simply be dropped from the admin form: the column is NOT NULL
 * with no default, so a create that omitted it failed at the insert. Removing
 * the column is what makes the form change safe.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            // SQLite rebuilds the whole table to drop a column and refuses
            // while an index still points at it, so the index goes first in a
            // statement of its own — same order as the zodiac drop.
            $table->dropIndex('categories_element_index');
        });

        Schema::table('categories', function (Blueprint $table) {
            $table->dropColumn('element');
        });
    }

    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            // Nullable, where the original was NOT NULL: the values are gone
            // and a NOT NULL column with no default cannot be added back to a
            // table that already has rows. Structure only.
            $table->string('element', 20)->nullable()->index()->after('slug');
        });
    }
};
