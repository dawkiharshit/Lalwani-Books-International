<?php

use App\Models\Category;
use App\Models\Product;
use Database\Seeders\CategorySeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Collections were the four elements (Fire/Earth/Air/Water). This store is
 * built around the twelve rashis, so each sign becomes its own collection and
 * every product moves to the rashi it was composed for.
 *
 * Elements are not lost — each rashi collection keeps its tattva, so
 * `?element=fire` filters carry on working unchanged.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function () {
            $oldIds = Category::whereIn('slug', ['fire', 'earth', 'air', 'water'])->pluck('id');

            /*
             * 1. Create (or update) the twelve rashi collections.
             *
             * Written through the query builder, not Category::updateOrCreate.
             * At this point in history categories.element is NOT NULL, but the
             * model's $fillable is whatever it is TODAY — and element was later
             * removed from it. Mass assignment silently dropped the column, so
             * the insert violated the constraint and a migration from scratch
             * died here. A migration records what happened; it cannot depend on
             * a model that keeps changing underneath it.
             */
            foreach (CategorySeeder::RASHIS as $i => [$slug, $rashi, $sign, $element, $tagline]) {
                DB::table('categories')->updateOrInsert(
                    ['slug' => $slug],
                    [
                        'name' => "{$rashi} · {$sign}",
                        'element' => $element,
                        'tagline' => $tagline,
                        'description' => "The perfume composed for {$rashi} ({$sign}) — its tattva, its ruling graha, its temperament.",
                        'sort_order' => $i + 1,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]
                );
            }

            // 2. Point every product at the collection for its own sign.
            $bySign = Category::whereIn('slug', array_column(CategorySeeder::RASHIS, 0))
                ->get()
                ->keyBy(fn (Category $c) => strtolower(explode(' · ', $c->name)[1] ?? ''));

            Product::withoutGlobalScopes()->get()->each(function (Product $p) use ($bySign) {
                $target = $bySign->get(strtolower((string) $p->zodiac_sign));
                if ($target && $p->category_id !== $target->id) {
                    $p->forceFill(['category_id' => $target->id])->save();
                }
            });

            // 3. Retire the old element collections — only once they are empty.
            Category::whereIn('id', $oldIds)
                ->whereDoesntHave('products')
                ->delete();
        });
    }

    public function down(): void
    {
        // One-way data reshape: the element collections are recreated by the
        // seeder if they are ever needed again.
    }
};
