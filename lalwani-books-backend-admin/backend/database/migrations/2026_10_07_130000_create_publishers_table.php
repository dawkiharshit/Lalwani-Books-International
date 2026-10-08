<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Publishers become records of their own, the way authors did — created in
 * admin → Publishers, chosen on a book, listed on the storefront's
 * Publications page, each with a shelf of their books. Every publisher name
 * already typed on a book is turned into a record here and the book linked to
 * it, so nothing on the site changes until the admin adds logos. The books'
 * `publisher` text stays as the display copy, kept in sync.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('publishers', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->string('slug', 140)->unique();
            $table->string('logo')->nullable();
            $table->text('description')->nullable();
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::table('products', function (Blueprint $table) {
            $table->foreignId('publisher_id')->nullable()->after('author_id')->constrained()->nullOnDelete();
        });

        $names = DB::table('products')
            ->whereNotNull('publisher')
            ->where('publisher', '!=', '')
            ->distinct()
            ->orderBy('publisher')
            ->pluck('publisher');

        $order = 0;
        foreach ($names as $raw) {
            $name = trim((string) $raw);
            $slug = Str::slug($name);
            if ($slug === '') {
                continue;
            }
            $id = DB::table('publishers')->where('slug', $slug)->value('id')
                ?? DB::table('publishers')->insertGetId([
                    'name' => $name,
                    'slug' => $slug,
                    'sort_order' => ++$order,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            DB::table('products')->where('publisher', $raw)->update(['publisher_id' => $id]);
        }
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropConstrainedForeignId('publisher_id');
        });
        Schema::dropIfExists('publishers');
    }
};
