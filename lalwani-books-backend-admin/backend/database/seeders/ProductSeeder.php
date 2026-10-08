<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Database\Seeder;

/**
 * Lalwani Books International catalogue, grouped by what a shopper actually browses for:
 * Skin, Hair, Makeup, Luxury Fragrance, Bath & Body, Gifting, Handicraft.
 *
 * Images are Unsplash CDN URLs (Unsplash Licence: free commercial use, no
 * attribution). Each was inspected before use; roughly half the candidates were
 * discarded for showing real brands — Nécessaire, NARS, Bobbi Brown, Chanel,
 * Estée Lauder, Diptyque, EIGSHOW among them. Replace these with your own
 * product photography before launch.
 */
class ProductSeeder extends Seeder
{
    private const U = 'https://images.unsplash.com/';
    private const Q = '?auto=format&fit=crop&w=900&q=80';

    /**
     * Extra shots per category, so the gallery has something to show beyond the
     * hero image. Every id here was inspected for competitor branding before
     * use — roughly half the Unsplash candidates were discarded for showing
     * real brands. Products within a category share this pool, so some images
     * repeat; replace with your own photography per product before launch.
     */
    private const GALLERY = [
        "skin" => [
            "photo-1620916297397-a4a5402a3c6c",
            "photo-1616750819456-5cdee9b85d22",
            "photo-1583209814683-c023dd293cc6",
        ],
        "hair" => [
            "photo-1560264641-1b5191cc63e2",
            "photo-1522337360788-8b13dee7a37e",
            "photo-1500917293891-ef795e70e1f6",
            "photo-1564141696939-9eb6e957ccfc",
        ],
        "makeup" => [
            "photo-1678695692040-e9a39502c357",
            "photo-1620464003286-a5b0d79f32c2",
            "photo-1622364649682-e7af9fecc43d",
            "photo-1596462502278-27bfdc403348",
        ],
        "fragrance" => [
            "photo-1543422655-ac1c6ca993ed",
            "photo-1458538977777-0549b2370168",
        ],
        "bath-body" => [
            "photo-1618840313409-66c0d92d6f26",
            "photo-1584305574647-0cc949a2bb9f",
            "photo-1600857544200-b2f666a9a2ec",
        ],
        "gifting" => [
            "photo-1617118601021-4992c028fe5d",
            "photo-1513201099705-a9746e1e201f",
            "photo-1592903297149-37fb25202dfa",
        ],
        "handicraft" => [
            "photo-1590605095243-072811dbe64c",
            "photo-1609881583302-61548332039c",
            "photo-1595351298020-038700609878",
        ],
    ];

    public function run(): void
    {
        $cat = Category::pluck('id', 'slug');

        $seen = 0;

        foreach ($this->products() as $i => $p) {
            if (! isset($cat[$p['cat']])) {
                $this->command?->warn("Skipping {$p['slug']}: no category '{$p['cat']}'");
                continue;
            }

            $row = Product::updateOrCreate(['slug' => $p['slug']], [
                'category_id' => $cat[$p['cat']],
                'image' => self::U.$p['img'].self::Q,
                'name' => $p['name'],
                'tagline' => $p['tagline'],
                'description' => $p['description'],
                'price' => $p['price'],
                'compare_at_price' => $p['compare_at'] ?? null,
                'stock' => 120,
                'sku' => $p['sku'],
                'size_ml' => $p['size'] ?? null,
                'is_featured' => $p['featured'] ?? false,
                'is_bestseller' => $p['bestseller'] ?? false,
                'is_active' => true,
                'color_from' => $p['from'],
                'color_to' => $p['to'],
                'accent' => $p['accent'],
                'notes_top' => $p['top'],
                'notes_heart' => $p['heart'],
                'notes_base' => $p['base'],
            ]);

            $seen += $this->syncGallery($row, $p);
        }

        if ($seen) {
            $this->command?->info("Attached {$seen} gallery images.");
        }

        // Products seeded under the retired rashi catalogue would otherwise linger
        // in the collection with a stale category. Anything not in this list goes.
        $keep = array_column($this->products(), 'slug');
        $gone = Product::withoutGlobalScopes()->whereNotIn('slug', $keep)->delete();
        if ($gone) $this->command?->info("Removed {$gone} products from the previous catalogue.");
    }

    /**
     * Rebuilds a product's gallery from its category pool, hero image first.
     * Rows are replaced rather than appended, so re-seeding does not stack
     * duplicate images on a product that already had some.
     */
    private function syncGallery(Product $row, array $p): int
    {
        $pool = self::GALLERY[$p['cat']] ?? [];
        if (! $pool) {
            return 0;
        }

        // Hero first, then the rest of the pool. Rotating by the product's own
        // position means two products in one category do not open on the same
        // shot even though they draw from the same handful of photographs.
        $rest = array_values(array_filter($pool, fn ($id) => $id !== $p['img']));
        $offset = crc32($p['slug']) % max(count($rest), 1);
        $rest = array_merge(array_slice($rest, $offset), array_slice($rest, 0, $offset));

        $ids = array_merge([$p['img']], $rest);

        $row->images()->delete();
        foreach ($ids as $sort => $id) {
            $row->images()->create([
                'path' => self::U.$id.self::Q,
                'alt' => $p['name'],
                'sort' => $sort,
            ]);
        }

        return count($ids);
    }

    private function products(): array
    {
        return [
            // ── Skin ────────────────────────────────────────────────────────
            [
                'cat' => 'skin', 'sku' => 'LBI-S01', 'size' => 30,
                'name' => 'Golden Hour Propolis Serum', 'slug' => 'golden-hour-propolis-serum',
                'img' => 'photo-1620916297397-a4a5402a3c6c',
                'price' => 3899, 'featured' => true, 'bestseller' => true,
                'tagline' => 'Crowned in gold.',
                'from' => '#F2C062', 'to' => '#C08A2A', 'accent' => '#9A6B18',
                'top' => 'Propolis, Golden Amber', 'heart' => 'Orange Blossom, Niacinamide', 'base' => 'Vanilla, Honeycomb',
                'description' => 'Eighty percent propolis extract with 5% niacinamide — the pairing that takes redness down and radiance up over four weeks. Thick as syrup in the dropper, weightless the moment it meets skin.',
            ],
            [
                'cat' => 'skin', 'sku' => 'LBI-S02', 'size' => 50,
                'name' => 'Velvet Royal Jelly Cream', 'slug' => 'velvet-royal-jelly-cream',
                'img' => 'photo-1583209814683-c023dd293cc6',
                'price' => 4299, 'bestseller' => true,
                'tagline' => 'Grounded in luxury.',
                'from' => '#D9A566', 'to' => '#8A5420', 'accent' => '#6B3F14',
                'top' => 'Royal Jelly, Bergamot', 'heart' => 'Damask Rose, Shea', 'base' => 'Sandalwood, Honey Wax',
                'description' => 'Royal jelly, squalane and ceramide NP whipped into a cream that sits like velvet and sinks without residue. Built for slow, deliberate skincare.',
            ],
            [
                'cat' => 'skin', 'sku' => 'LBI-S03', 'size' => 120,
                'name' => 'Dew Nectar Hydrating Essence', 'slug' => 'dew-nectar-essence',
                'img' => 'photo-1616750819456-5cdee9b85d22',
                'price' => 2199,
                'tagline' => 'Dream in layers.',
                'from' => '#A8DCD6', 'to' => '#4A9C94', 'accent' => '#3A7D77',
                'top' => 'Nashi Pear, Honey Water', 'heart' => 'Water Lily, Hyaluronic', 'base' => 'Ambergris, White Musk',
                'description' => 'Five molecular weights of hyaluronic acid suspended in honey water, layerable three times over without a hint of tack. Skin drinks it and keeps drinking.',
            ],
            // ── Hair ────────────────────────────────────────────────────────
            [
                'cat' => 'hair', 'sku' => 'LBI-H01', 'size' => 200,
                'name' => 'Honey Gloss Hair Mask', 'slug' => 'honey-gloss-hair-mask',
                'img' => 'photo-1560264641-1b5191cc63e2',
                'price' => 2499, 'bestseller' => true,
                'tagline' => 'Shine you can feel.',
                'from' => '#E8C07A', 'to' => '#A9762A', 'accent' => '#8A5E18',
                'top' => 'Raw Honey, Bergamot', 'heart' => 'Argan, Hydrolysed Silk', 'base' => 'Beeswax, Vanilla',
                'description' => 'Ten minutes of raw honey, argan and hydrolysed silk protein. Curls keep their shape, colour keeps its depth, and nothing is left greasy at the root.',
            ],
            [
                'cat' => 'hair', 'sku' => 'LBI-H02', 'size' => 60,
                'name' => 'Propolis Scalp Serum', 'slug' => 'propolis-scalp-serum',
                'img' => 'photo-1522337360788-8b13dee7a37e',
                'price' => 2899,
                'tagline' => 'Start at the root.',
                'from' => '#BEDBA8', 'to' => '#6F9560', 'accent' => '#547542',
                'top' => 'Propolis, Green Tea', 'heart' => 'Rosemary, Panthenol', 'base' => 'Cedarwood, Zinc',
                'description' => 'A weightless scalp treatment of propolis, rosemary and 2% piroctone olamine for flaking and itch. Use three nights a week; it will not weigh down fine hair.',
            ],
            [
                'cat' => 'hair', 'sku' => 'LBI-H03', 'size' => 75,
                'name' => 'Beeswax Smoothing Balm', 'slug' => 'beeswax-smoothing-balm',
                'img' => 'photo-1500917293891-ef795e70e1f6',
                'price' => 1699,
                'tagline' => 'Flyaways, finished.',
                'from' => '#C0A488', 'to' => '#6B5240', 'accent' => '#55402F',
                'top' => 'Beeswax, Iris', 'heart' => 'Shea, Cashmere Wood', 'base' => 'Oakmoss, Musk',
                'description' => 'Unrefined beeswax and shea worked into a balm that tames edges and split ends without stiffness. Warm a little between the palms and press, do not rake.',
            ],
            // ── Makeup ──────────────────────────────────────────────────────
            [
                'cat' => 'makeup', 'sku' => 'LBI-M01', 'size' => 15,
                'name' => 'Nectar Tinted Lip Balm', 'slug' => 'nectar-tinted-lip-balm',
                'img' => 'photo-1678695692040-e9a39502c357',
                'price' => 1199, 'bestseller' => true,
                'tagline' => 'Colour, softened.',
                'from' => '#F4BCC9', 'to' => '#DE8AA4', 'accent' => '#C4708C',
                'top' => 'Damask Rose, Honey', 'heart' => 'Peony, Shea', 'base' => 'Beeswax, Vanilla',
                'description' => 'Six sheer washes of colour carried in beeswax and honey. It wears like a balm, not a stain, and reapplies without building up.',
            ],
            [
                'cat' => 'makeup', 'sku' => 'LBI-M02', 'size' => 12,
                'name' => 'Golden Hour Cream Highlighter', 'slug' => 'golden-hour-highlighter',
                'img' => 'photo-1620464003286-a5b0d79f32c2',
                'price' => 1899,
                'tagline' => 'Lit from beneath.',
                'from' => '#F6D9A0', 'to' => '#C99A3C', 'accent' => '#9E7526',
                'top' => 'Golden Amber, Bergamot', 'heart' => 'Orange Blossom, Squalane', 'base' => 'Honeycomb, Musk',
                'description' => 'A cream-to-skin highlighter with no visible glitter — the shine comes from finely milled mica suspended in squalane. Works on bare skin or over base.',
            ],
            [
                'cat' => 'makeup', 'sku' => 'LBI-M03', 'size' => 30,
                'name' => 'Honeyed Skin Tint', 'slug' => 'honeyed-skin-tint',
                'img' => 'photo-1622364649682-e7af9fecc43d',
                'price' => 2599, 'compare_at' => 3199,
                'tagline' => 'Two finishes, one bottle.',
                'from' => '#F4D98A', 'to' => '#C9A03C', 'accent' => '#9E7A1C',
                'top' => 'Sicilian Lemon, Honey', 'heart' => 'Neroli, Niacinamide', 'base' => 'Jojoba, White Musk',
                'description' => 'Twelve shades of buildable tint with 3% niacinamide worked in, so a full day of wear leaves skin better than it found it. Sheer on the first pass, medium on the second.',
            ],
            // ── Luxury Fragrance ────────────────────────────────────────────
            [
                'cat' => 'fragrance', 'sku' => 'LBI-F01', 'size' => 50,
                'name' => 'Midnight Bloom Eau de Parfum', 'slug' => 'midnight-bloom-edp',
                'img' => 'photo-1543422655-ac1c6ca993ed',
                'price' => 5499, 'featured' => true,
                'tagline' => 'Intensity has a scent.',
                'from' => '#B9546A', 'to' => '#5E2233', 'accent' => '#471A27',
                'top' => 'Black Cherry, Plum', 'heart' => 'Tuberose, Dark Rose', 'base' => 'Patchouli, Tonka',
                'description' => 'Black cherry and midnight plum descend into narcotic tuberose and shadowed rose, smouldering over patchouli and tonka. Eight hours on skin, longer on wool.',
            ],
            [
                'cat' => 'fragrance', 'sku' => 'LBI-F02', 'size' => 50,
                'name' => 'Amber Royale Eau de Parfum', 'slug' => 'amber-royale-edp',
                'img' => 'photo-1458538977777-0549b2370168',
                'price' => 5999, 'bestseller' => true,
                'tagline' => 'Crowned in gold.',
                'from' => '#E28B62', 'to' => '#B34A3E', 'accent' => '#93392F',
                'top' => 'Golden Amber, Bergamot', 'heart' => 'Orange Blossom, Labdanum', 'base' => 'Vanilla, Leather',
                'description' => 'Golden amber and sun-warmed bergamot blaze over orange blossom, finishing in regal vanilla and leather. Opulent, magnetic, and impossible to wear quietly.',
            ],
            // ── Bath & Body ─────────────────────────────────────────────────
            [
                'cat' => 'bath-body', 'sku' => 'LBI-B01', 'size' => 120,
                'name' => 'Raw Honey Cleansing Bar', 'slug' => 'raw-honey-cleansing-bar',
                'img' => 'photo-1618840313409-66c0d92d6f26',
                'price' => 749, 'bestseller' => true,
                'tagline' => 'Purity, perfected.',
                'from' => '#E8D5A8', 'to' => '#A9862A', 'accent' => '#836618',
                'top' => 'Raw Honey, Green Fig', 'heart' => 'Oat Milk, Sage', 'base' => 'Beeswax, Blond Woods',
                'description' => 'Cold-processed with raw honey and colloidal oat, cured six weeks. It lathers low and rinses clean, and it will not strip a compromised barrier the way a foaming wash does.',
            ],
            [
                'cat' => 'bath-body', 'sku' => 'LBI-B02', 'size' => 400,
                'name' => 'Honeycomb Milk Bath Soak', 'slug' => 'honeycomb-milk-bath-soak',
                'img' => 'photo-1584305574647-0cc949a2bb9f',
                'price' => 1899,
                'tagline' => 'Dissolve the day.',
                'from' => '#F3E2C8', 'to' => '#C9A03C', 'accent' => '#9E7A1C',
                'top' => 'Honey Dew, Oat Milk', 'heart' => 'Lavender, Chamomile', 'base' => 'Sandalwood, Musk',
                'description' => 'Coconut milk powder, raw honey and Epsom salt. Twenty minutes and skin comes out softened rather than stripped — no rinse needed afterwards.',
            ],
            [
                'cat' => 'bath-body', 'sku' => 'LBI-B03', 'size' => 200,
                'name' => 'Beeswax Body Butter', 'slug' => 'beeswax-body-butter',
                'img' => 'photo-1600857544200-b2f666a9a2ec',
                'price' => 2299,
                'tagline' => 'Built to last.',
                'from' => '#C0A488', 'to' => '#6B5240', 'accent' => '#55402F',
                'top' => 'Iris, Clary Sage', 'heart' => 'Beeswax, Cocoa Butter', 'base' => 'Oakmoss, Ceramide',
                'description' => 'An occlusive butter of beeswax, cocoa and ceramide for elbows, shins and anywhere winter has got to. Unglamorous, structural, and the reason everything else works.',
            ],
            // ── Gifting ─────────────────────────────────────────────────────
            [
                'cat' => 'gifting', 'sku' => 'LBI-G01', 'size' => null,
                'name' => 'The Golden Ritual Set', 'slug' => 'golden-ritual-set',
                'img' => 'photo-1617118601021-4992c028fe5d',
                'price' => 6499, 'compare_at' => 7899, 'featured' => true,
                'tagline' => 'Ready to give.',
                'from' => '#F2C062', 'to' => '#C08A2A', 'accent' => '#9A6B18',
                'top' => 'Propolis, Amber', 'heart' => 'Royal Jelly, Rose', 'base' => 'Honeycomb, Vanilla',
                'description' => 'The propolis serum, royal jelly cream and a honey cleansing bar in a hand-finished box with a note card. Arrives wrapped — nothing left for you to do.',
            ],
            [
                'cat' => 'gifting', 'sku' => 'LBI-G02', 'size' => null,
                'name' => 'Discovery Six', 'slug' => 'discovery-six',
                'img' => 'photo-1513201099705-a9746e1e201f',
                'price' => 2999,
                'tagline' => 'Six ways in.',
                'from' => '#F4D98A', 'to' => '#C9A03C', 'accent' => '#9E7A1C',
                'top' => 'Honey Nectar, Lemon', 'heart' => 'Neroli, Green Tea', 'base' => 'Jojoba, Musk',
                'description' => 'Six travel sizes across skin, hair and body — enough of each for a fortnight. The set price comes off a full size if you buy one afterwards.',
            ],
            // ── Handicraft ──────────────────────────────────────────────────
            [
                'cat' => 'handicraft', 'sku' => 'LBI-C01', 'size' => null,
                'name' => 'Hand-thrown Honey Pot', 'slug' => 'hand-thrown-honey-pot',
                'img' => 'photo-1590605095243-072811dbe64c',
                'price' => 3499,
                'tagline' => 'Objects with a story.',
                'from' => '#D8C6AE', 'to' => '#8A7050', 'accent' => '#6B563C',
                'top' => 'Stoneware, Ash Glaze', 'heart' => 'Wheel-thrown', 'base' => 'Food-safe Interior',
                'description' => 'Thrown and glazed by a studio potter in Jaipur, each pot slightly its own shape. Holds 250g of honey and comes with a turned beechwood dipper.',
            ],
            [
                'cat' => 'handicraft', 'sku' => 'LBI-C02', 'size' => null,
                'name' => 'Potter\'s Wheel Vanity Tray', 'slug' => 'potters-wheel-vanity-tray',
                'img' => 'photo-1609881583302-61548332039c',
                'price' => 2799,
                'tagline' => 'A place for everything.',
                'from' => '#E0CDB4', 'to' => '#967A56', 'accent' => '#6B563C',
                'top' => 'Stoneware, Matte Glaze', 'heart' => 'Wheel-thrown', 'base' => 'Felted Base',
                'description' => 'A shallow stoneware tray for the corner of a dressing table — serum, balm, rings. Felted underneath so it will not mark the surface.',
            ],
        ];
    }
}
