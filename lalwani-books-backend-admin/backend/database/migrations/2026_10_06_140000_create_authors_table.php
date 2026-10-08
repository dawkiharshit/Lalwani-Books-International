<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Authors become records of their own — created in admin, chosen on a book,
 * shown with a photo on the storefront — the way categories already work.
 * Every author name already typed on a book is turned into a record here and
 * the book linked to it, so nothing on the site changes until the admin adds
 * photos. The books' `author` text stays as a display copy kept in sync.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('authors', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->string('slug', 140)->unique();
            $table->string('photo')->nullable();
            $table->text('bio')->nullable();
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::table('products', function (Blueprint $table) {
            $table->foreignId('author_id')->nullable()->after('category_id')->constrained()->nullOnDelete();
        });

        $names = DB::table('products')
            ->whereNotNull('author')
            ->where('author', '!=', '')
            ->distinct()
            ->orderBy('author')
            ->pluck('author');

        $order = 0;
        foreach ($names as $raw) {
            $name = trim((string) $raw);
            $slug = Str::slug($name);
            if ($slug === '') {
                continue;
            }
            $id = DB::table('authors')->where('slug', $slug)->value('id')
                ?? DB::table('authors')->insertGetId([
                    'name' => $name,
                    'slug' => $slug,
                    'sort_order' => ++$order,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            DB::table('products')->where('author', $raw)->update(['author_id' => $id]);
        }
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropConstrainedForeignId('author_id');
        });
        Schema::dropIfExists('authors');
    }
};
