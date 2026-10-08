<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The catalogue is books now. Author, publisher, ISBN and the rest are what a
 * reader looks for on a book page, and author is shown on every product card.
 *
 * The fragrance notes columns become optional: nothing in a bookstore fills
 * them, and keeping them required would block every new book from saving.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('author', 190)->nullable()->after('name');
            $table->string('publisher', 190)->nullable()->after('author');
            $table->string('isbn', 20)->nullable()->after('publisher');
            $table->unsignedSmallInteger('pages')->nullable()->after('isbn');
            $table->string('language', 60)->nullable()->after('pages');
            // Paperback, Hardcover, Board book...
            $table->string('binding', 40)->nullable()->after('language');
            $table->unsignedSmallInteger('published_year')->nullable()->after('binding');
            $table->index('author');
            $table->index('isbn');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->string('notes_top')->nullable()->change();
            $table->string('notes_heart')->nullable()->change();
            $table->string('notes_base')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex(['author']);
            $table->dropIndex(['isbn']);
            $table->dropColumn(['author', 'publisher', 'isbn', 'pages', 'language', 'binding', 'published_year']);
        });
    }
};
