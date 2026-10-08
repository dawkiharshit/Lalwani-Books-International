<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Storefront categories: what the shop sells, not which sign it belongs to.
 *
 * These replaced the twelve rashi collections. The astrology has since been
 * removed outright — the storefront copy, the API routes, and the product
 * columns that carried it are all gone.
 *
 * Images are Unsplash CDN URLs (Unsplash Licence: free for commercial use, no
 * attribution required). Every one was checked by eye for competitor branding
 * before being used — several otherwise-good candidates were rejected for
 * showing The Ordinary, Estée Lauder, Origins and Diptyque packaging.
 */
class CategorySeeder extends Seeder
{
    private const IMG = 'https://images.unsplash.com/';
    private const Q = '?auto=format&fit=crop&w=900&q=80';

    /** [slug, name, tagline, description, unsplash photo id] */
    public const CATEGORIES = [
        ['skin', 'Skin', 'Serums, masks and barrier care',
            'Honey, royal jelly and propolis formulated for the face — cleansing, treating and sealing.',
            'photo-1583209814683-c023dd293cc6'],
        ['hair', 'Hair', 'Scalp, shine and strength',
            'Honey-fed scalp care and conditioning treatments for hair that behaves in any weather.',
            'photo-1564141696939-9eb6e957ccfc'],
        ['makeup', 'Makeup', 'Colour that behaves like skincare',
            'Tinted balms, cream colour and a finish that treats skin while it wears.',
            'photo-1596462502278-27bfdc403348'],
        ['fragrance', 'Luxury Fragrance', 'Composed to be layered',
            'Eau de parfum built on honey, amber and resin — warm, lasting and unmistakable.',
            'photo-1458538977777-0549b2370168'],
        ['bath-body', 'Bath & Body', 'Soaks, butters and honey soaps',
            'Slow rituals for the whole body: cold-pressed soaps, beeswax butters and bath soaks.',
            'photo-1600857544200-b2f666a9a2ec'],
        ['gifting', 'Gifting', 'Sets that arrive ready to give',
            'Curated sets in hand-finished boxes with a note card — no wrapping required.',
            'photo-1592903297149-37fb25202dfa'],
        ['handicraft', 'Handicraft', 'Objects with a story',
            'Hand-thrown ceramics, woven baskets and beeswax candles from the makers we work with.',
            'photo-1595351298020-038700609878'],
    ];

    /** Kept for the historical convert_categories_to_rashis migration. */
    public const RASHIS = [
        ['aries', 'Mesh', 'Aries', 'fire', 'Bold, fearless, first'],
        ['taurus', 'Vrishabh', 'Taurus', 'earth', 'Grounded, devoted, indulgent'],
        ['gemini', 'Mithun', 'Gemini', 'air', 'Curious, witty, expressive'],
        ['cancer', 'Kark', 'Cancer', 'water', 'Intuitive, tender, protective'],
        ['leo', 'Simha', 'Leo', 'fire', 'Radiant, regal, generous'],
        ['virgo', 'Kanya', 'Virgo', 'earth', 'Precise, thoughtful, refined'],
        ['libra', 'Tula', 'Libra', 'air', 'Harmonious, charming, elegant'],
        ['scorpio', 'Vrishchik', 'Scorpio', 'water', 'Magnetic, intense, mysterious'],
        ['sagittarius', 'Dhanu', 'Sagittarius', 'fire', 'Adventurous, free, optimistic'],
        ['capricorn', 'Makar', 'Capricorn', 'earth', 'Timeless, disciplined, noble'],
        ['aquarius', 'Kumbh', 'Aquarius', 'air', 'Visionary, original, electric'],
        ['pisces', 'Meen', 'Pisces', 'water', 'Dreamy, artistic, empathic'],
    ];

    public function run(): void
    {
        DB::transaction(function () {
            foreach (self::CATEGORIES as $i => [$slug, $name, $tagline, $desc, $photo]) {
                Category::updateOrCreate(['slug' => $slug], [
                    'name' => $name,
                    'tagline' => $tagline,
                    'description' => $desc,
                    'image' => self::IMG.$photo.self::Q,
                    'sort_order' => $i + 1,
                ]);
            }

            // Retire the rashi collections. Products are parked on Skin first so
            // the delete cannot orphan a row or trip the foreign key; ProductSeeder
            // runs next and puts each one in its real category.
            $keep = array_column(self::CATEGORIES, 0);
            $stale = Category::whereNotIn('slug', $keep)->pluck('id');

            if ($stale->isNotEmpty()) {
                $fallback = Category::where('slug', 'skin')->value('id');
                Product::withoutGlobalScopes()->whereIn('category_id', $stale)
                    ->update(['category_id' => $fallback]);
                Category::whereIn('id', $stale)->delete();
                $this->command?->info('Retired '.$stale->count().' rashi categories.');
            }
        });
    }
}
