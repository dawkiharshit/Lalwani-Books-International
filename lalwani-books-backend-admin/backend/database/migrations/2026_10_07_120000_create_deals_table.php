<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Deals: the offers that slide through the home page's Deals Of The Week
     * panel, one every five seconds.
     *
     * The single offer that used to be written in settings (home_deals_*)
     * becomes the first deal, so nothing on the site changes wording. A deal
     * for the Fiction and the Science shelf follows when that shelf has at
     * least two books that really are reduced — the slider starts with real
     * offers, never invented ones, and each can be edited or switched off in
     * admin → Deals.
     */
    public function up(): void
    {
        Schema::create('deals', function (Blueprint $table) {
            $table->id();
            $table->string('eyebrow', 60)->nullable();
            // "{discount}" is replaced with the best saving among the deal's books.
            $table->string('heading', 160);
            $table->string('highlight', 80)->nullable();
            $table->string('description', 300)->nullable();
            $table->string('ends_label', 60)->nullable();
            // Null: the countdown runs to Sunday midnight, every week.
            $table->timestamp('ends_at')->nullable();
            $table->string('button_text', 40)->nullable();
            $table->string('button_url', 300)->nullable();
            // Null: the deal covers every reduced book in the shop.
            $table->foreignId('category_id')->nullable()->constrained()->nullOnDelete();
            $table->string('theme', 20)->default('coral');
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
            $table->index(['is_active', 'sort_order']);
        });

        $setting = function (string $key, string $fallback): string {
            $value = DB::table('settings')->where('key', $key)->value('value');

            return $value === null ? $fallback : trim((string) $value);
        };
        $now = now();

        DB::table('deals')->insert([
            'eyebrow' => $setting('home_deals_eyebrow', 'This week only') ?: null,
            'heading' => $setting('home_deals_heading', 'Save up to {discount}% on books') ?: 'Save up to {discount}% on books',
            'description' => $setting('home_deals_text', 'Hand-picked titles at reduced prices. Hurry — the deals run out soon.') ?: null,
            'ends_label' => $setting('home_deals_ends', 'Ends Sunday midnight') ?: null,
            'theme' => 'coral',
            'is_active' => true,
            'sort_order' => 1,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $shelves = [
            [
                'slug' => 'fiction',
                'theme' => 'pine',
                'eyebrow' => 'Fiction favourites',
                'heading' => 'Novels up to {discount}% off',
                'description' => 'Classic and contemporary fiction at reduced prices — while stocks last.',
                'button_text' => 'Shop fiction',
            ],
            [
                'slug' => 'science',
                'theme' => 'plum',
                'eyebrow' => 'For curious minds',
                'heading' => 'Science books up to {discount}% off',
                'description' => 'Popular science and reference titles at a saving this week.',
                'button_text' => 'Shop science',
            ],
        ];

        $order = 2;
        foreach ($shelves as $shelf) {
            $categoryId = DB::table('categories')->where('slug', $shelf['slug'])->value('id');
            if (! $categoryId) {
                continue;
            }
            $reduced = DB::table('products')
                ->where('category_id', $categoryId)
                ->where('is_active', true)
                ->whereColumn('compare_at_price', '>', 'price')
                ->count();
            if ($reduced < 2) {
                continue;
            }

            DB::table('deals')->insert([
                'eyebrow' => $shelf['eyebrow'],
                'heading' => $shelf['heading'],
                'description' => $shelf['description'],
                'ends_label' => 'Ends Sunday midnight',
                'button_text' => $shelf['button_text'],
                'button_url' => '/collection?category='.$shelf['slug'],
                'category_id' => $categoryId,
                'theme' => $shelf['theme'],
                'is_active' => true,
                'sort_order' => $order++,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('deals');
    }
};
