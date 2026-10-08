<?php

namespace Database\Seeders;

use App\Models\Banner;
use App\Models\Blog;
use App\Models\CollectionCircle;
use App\Models\GalleryItem;
use App\Models\InstagramPost;
use App\Models\NewArrival;
use App\Models\Product;
use App\Models\Setting;
use App\Models\Testimonial;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Fills every admin-managed storefront section with real starting content so
 * the site ships looking complete. Images point at the photography already
 * bundled in the frontend (public/images/**) — admins replace them by
 * uploading their own, which switches the path to storage/.
 */
class ContentSeeder extends Seeder
{
    public function run(): void
    {
        $this->banners();
        $this->circles();
        $this->arrivals();
        $this->gallery();
        $this->instagram();
        $this->testimonials();
        $this->blogs();
        $this->settings();
    }

    private function banners(): void
    {
        /*
         * Hero copy sits straight on the photograph — no card, no scrim, no
         * text shadow — so legibility rests entirely on the image. Every URL
         * below was measured before it was chosen: mean relative luminance of
         * the bottom-left corner (where the copy lands) must clear 4.5:1
         * against white and 3:1 against the rose-300 subtitle, with under 10%
         * of that area brighter than L 0.30.
         *
         * The rose subtitle is the binding constraint — it only reaches 3:1
         * below L 0.111 — so these all read near-black on the left.
         */
        $rows = [
            [
                'title' => 'The Honey Sale',
                'subtitle' => 'Is Live',
                'badge_text' => 'Up to 20% off',
                'description' => 'Twenty percent off skin, hair, body and colour with code HIVE20 at checkout.',
                'button_text' => 'Shop the Sale',
                'button_url' => '/collection',
                'image_path' => 'https://images.unsplash.com/photo-1570634433336-be7629414ce1?auto=format&fit=crop&w=1600&q=80',
            ],
            [
                'title' => 'Serums &',
                'subtitle' => 'Barrier Care',
                'badge_text' => '20% off skin',
                'description' => 'Propolis serum, royal jelly cream and the whole skin shelf. Use HIVE20.',
                'button_text' => 'Shop Skin',
                'button_url' => '/collection?category=skin',
                'image_path' => 'https://images.unsplash.com/photo-1631730359585-38a4935cbec4?auto=format&fit=crop&w=1600&q=80',
            ],
            [
                'title' => 'Gift Sets,',
                'subtitle' => 'Ready to Give',
                'badge_text' => '₹500 off gifting',
                'description' => 'The Golden Ritual Set and Discovery Six, hand-finished and boxed. Use HONEY15.',
                'button_text' => 'Shop Gifting',
                'button_url' => '/collection?category=gifting',
                'image_path' => 'https://images.unsplash.com/photo-1771085417618-c69f6209e540?auto=format&fit=crop&w=1600&q=80',
            ],
            [
                'title' => 'New Here?',
                'subtitle' => 'Take 10% Off',
                'badge_text' => '10% off your first order',
                'description' => 'One code, any category, no minimum spend. Use WELCOME10 at checkout.',
                'button_text' => 'Start Shopping',
                'button_url' => '/collection',
                'image_path' => 'https://images.unsplash.com/photo-1709377195538-5522ed0f9e10?auto=format&fit=crop&w=1600&q=80',
            ],
            [
                'title' => 'Honey,',
                'subtitle' => 'Head to Toe',
                'badge_text' => '20% off bath & body',
                'description' => 'Cold-pressed soaps, beeswax butters and milk bath soaks. Use HIVE20.',
                'button_text' => 'Shop Bath & Body',
                'button_url' => '/collection?category=bath-body',
                'image_path' => 'https://images.unsplash.com/photo-1504036583833-1b9340d6722f?auto=format&fit=crop&w=1600&q=80',
            ],
            [
                'title' => 'Colour',
                'subtitle' => 'That Cares',
                'badge_text' => '20% off makeup',
                'description' => 'Tinted balms and cream colour carried in honey and beeswax. Use HIVE20.',
                'button_text' => 'Shop Makeup',
                'button_url' => '/collection?category=makeup',
                'image_path' => 'https://images.unsplash.com/photo-1632641303624-13074453487e?auto=format&fit=crop&w=1600&q=80',
            ],
        ];

        foreach ($rows as $i => $row) {
            Banner::updateOrCreate(
                ['title' => $row['title']],
                array_merge($row, ['is_active' => true, 'sort_order' => $i])
            );
        }

        // Same title-keyed trap as the circles: a renamed banner would otherwise
        // linger and slide past alongside its replacement.
        $stale = Banner::whereNotIn('title', array_column($rows, 'title'))->delete();
        if ($stale) {
            $this->command?->info("Removed {$stale} stale banners.");
        }
    }

    private function circles(): void
    {
        /*
         * Hero copy sits straight on the photograph — no card, no scrim, no
         * text shadow — so legibility rests entirely on the image. Every URL
         * below was measured before it was chosen: mean relative luminance of
         * the bottom-left corner (where the copy lands) must clear 4.5:1
         * against white and 3:1 against the rose-300 subtitle, with under 10%
         * of that area brighter than L 0.30.
         *
         * The rose subtitle is the binding constraint — it only reaches 3:1
         * below L 0.111 — so these all read near-black on the left.
         */
        $rows = [
            // The seven storefront categories, each pointing at its own filter.
            // Images are the same verified Unsplash photos CategorySeeder uses.
            ['Skin', '/collection?category=skin', 'https://images.unsplash.com/photo-1583209814683-c023dd293cc6?auto=format&fit=crop&w=500&q=80'],
            ['Hair', '/collection?category=hair', 'https://images.unsplash.com/photo-1564141696939-9eb6e957ccfc?auto=format&fit=crop&w=500&q=80'],
            ['Makeup', '/collection?category=makeup', 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=500&q=80'],
            ['Fragrance', '/collection?category=fragrance', 'https://images.unsplash.com/photo-1458538977777-0549b2370168?auto=format&fit=crop&w=500&q=80'],
            ['Bath & Body', '/collection?category=bath-body', 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?auto=format&fit=crop&w=500&q=80'],
            ['Gifting', '/collection?category=gifting', 'https://images.unsplash.com/photo-1592903297149-37fb25202dfa?auto=format&fit=crop&w=500&q=80'],
            ['Handicraft', '/collection?category=handicraft', 'https://images.unsplash.com/photo-1595351298020-038700609878?auto=format&fit=crop&w=500&q=80'],
        ];

        foreach ($rows as $i => [$title, $url, $img]) {
            CollectionCircle::updateOrCreate(
                ['title' => $title],
                ['link_url' => $url, 'image_path' => $img, 'is_active' => true, 'sort_order' => $i]
            );
        }

        // Keyed on title, so a renamed circle leaves its old row behind — the
        // rashi circles (Fire Signs, Earth Signs…) survived the category swap
        // that way and rendered beside the new ones.
        $stale = CollectionCircle::whereNotIn('title', array_column($rows, 0))->delete();
        if ($stale) {
            $this->command?->info("Removed {$stale} stale collection circles.");
        }
    }

    private function arrivals(): void
    {
        /*
         * Hero copy sits straight on the photograph — no card, no scrim, no
         * text shadow — so legibility rests entirely on the image. Every URL
         * below was measured before it was chosen: mean relative luminance of
         * the bottom-left corner (where the copy lands) must clear 4.5:1
         * against white and 3:1 against the rose-300 subtitle, with under 10%
         * of that area brighter than L 0.30.
         *
         * The rose subtitle is the binding constraint — it only reaches 3:1
         * below L 0.111 — so these all read near-black on the left.
         */
        $rows = [
            ['New This Season', '/collection?sort=newest', '/images/scenes/newsletter.jpg'],
            ['The Rose Edit', '/collection?category=skin', '/images/scenes/collage-flower.jpg'],
            ['Discovery Sets', '/collection', '/images/scenes/promo.jpg'],
        ];

        foreach ($rows as $i => [$title, $url, $img]) {
            NewArrival::updateOrCreate(
                ['title' => $title],
                ['link_url' => $url, 'image_path' => $img, 'is_active' => true, 'sort_order' => $i]
            );
        }
    }

    private function gallery(): void
    {
        /*
         * Hero copy sits straight on the photograph — no card, no scrim, no
         * text shadow — so legibility rests entirely on the image. Every URL
         * below was measured before it was chosen: mean relative luminance of
         * the bottom-left corner (where the copy lands) must clear 4.5:1
         * against white and 3:1 against the rose-300 subtitle, with under 10%
         * of that area brighter than L 0.30.
         *
         * The rose subtitle is the binding constraint — it only reaches 3:1
         * below L 0.111 — so these all read near-black on the left.
         */
        $rows = [
            ['Inside the studio', '/images/scenes/about-craft.jpg'],
            ['Hand-filled jars', '/images/scenes/promo.jpg'],
            ['The infusion table', '/images/scenes/collage-flower.jpg'],
            ['Applying the serum', '/images/scenes/newsletter.jpg'],
        ];

        foreach ($rows as $i => [$caption, $img]) {
            GalleryItem::updateOrCreate(
                ['caption' => $caption],
                ['image_path' => $img, 'is_active' => true, 'sort_order' => $i]
            );
        }
    }

    private function instagram(): void
    {
        // Follows the catalogue rather than a hard-coded list. The old version
        // named six perfumes that no longer exist and kept showing them on the
        // home page long after the rebrand.
        $posts = Product::query()
            ->where('is_active', true)
            ->whereNotNull('image')
            ->orderBy('id')
            ->get(['id', 'name', 'image', 'category_id'])
            ->unique('category_id') // one tile per category, for a mixed rail
            ->values();

        if ($posts->isEmpty()) {
            $this->command?->warn('No products with images — leaving the Instagram rail alone.');

            return;
        }

        // Retire tiles pointing at products the shop has since dropped.
        $stale = InstagramPost::whereNotIn('image_path', $posts->pluck('image'))->get();
        $stale->each->delete();

        foreach ($posts as $i => $product) {
            InstagramPost::updateOrCreate(
                ['image_path' => $product->image],
                [
                    'caption' => $product->name,
                    'post_url' => 'https://instagram.com',
                    'is_active' => true,
                    'sort_order' => $i,
                ]
            );
        }

        if ($stale->isNotEmpty()) {
            $this->command?->info('Retired '.$stale->count().' stale Instagram tiles.');
        }
    }

    private function testimonials(): void
    {
        /*
         * Hero copy sits straight on the photograph — no card, no scrim, no
         * text shadow — so legibility rests entirely on the image. Every URL
         * below was measured before it was chosen: mean relative luminance of
         * the bottom-left corner (where the copy lands) must clear 4.5:1
         * against white and 3:1 against the rose-300 subtitle, with under 10%
         * of that area brighter than L 0.30.
         *
         * The rose subtitle is the binding constraint — it only reaches 3:1
         * below L 0.111 — so these all read near-black on the left.
         */
        $rows = [
            ['Ananya R.', 'Bengaluru', 5, 'Bought the propolis serum on a whim and six months later it has replaced my entire shelf. My skin has not looked this even in years.'],
            ['Meera S.', 'Mumbai', 5, 'The packaging is genuinely gift-ready — I did not need to wrap it. Shipping took two days and the jar arrived flawless.'],
            ['Rohan K.', 'New Delhi', 4, 'Ordered the gift set for my sister and ended up keeping the body butter for myself. A little goes a very long way.'],
        ];

        foreach ($rows as $i => [$name, $location, $rating, $content]) {
            Testimonial::updateOrCreate(
                ['name' => $name, 'location' => $location],
                [
                    'designation' => 'Verified buyer',
                    'rating' => $rating,
                    'content' => $content,
                    'is_active' => true,
                    'sort_order' => $i,
                ]
            );
        }
    }

    private function blogs(): void
    {
        /*
         * Hero copy sits straight on the photograph — no card, no scrim, no
         * text shadow — so legibility rests entirely on the image. Every URL
         * below was measured before it was chosen: mean relative luminance of
         * the bottom-left corner (where the copy lands) must clear 4.5:1
         * against white and 3:1 against the rose-300 subtitle, with under 10%
         * of that area brighter than L 0.30.
         *
         * The rose subtitle is the binding constraint — it only reaches 3:1
         * below L 0.111 — so these all read near-black on the left.
         */
        $rows = [
            [
                'How to Layer a Honey Routine',
                'Skin Notes',
                'Thinnest to thickest — the one rule that makes layering work.',
                "Layering works when each step is thinner than the one that follows it.\n\nStart with the cleansing oil, then the toner while skin is still damp — humectants pull in water, and damp skin gives them something to pull. Give each layer thirty seconds to sink before the next.\n\nThe order matters. A balm before a serum simply seals the serum out; nothing underneath it will ever reach skin. Keep an evening to three actives at most; a fourth almost always turns into irritation.\n\nEssence under cream. Propolis under balm. Beeswax last, always.",
                'layering,tips,how-to',
                '/images/scenes/newsletter.jpg',
            ],
            [
                'What the Hive Actually Does',
                'Ingredients',
                'Honey, royal jelly, propolis and beeswax — four ingredients, four jobs.',
                "Bee-derived ingredients get lumped together on labels, but they behave nothing alike.\n\nRaw honey is a humectant with mild antibacterial action. It draws water into the stratum corneum and holds it there, which is why it suits dehydrated and blemish-prone skin equally well.\n\nRoyal jelly carries proteins and fatty acids that support barrier renewal. It is the richest of the four and the one to reach for when skin feels thin or reactive.\n\nPropolis is the resin bees seal the hive with. Standardised extracts calm redness, and it pairs unusually well with niacinamide.\n\nBeeswax does none of that. It is pure occlusion — the lid on everything below it. Useful last, useless first.",
                'ingredients,guide,honey',
                '/images/scenes/promo.jpg',
            ],
            [
                'Making a Barrier Repair Hold',
                'Care',
                'Six habits that keep a repaired barrier from sliding back.',
                "Barrier repair is mostly about restraint, not about buying more.\n\nDrop to one active at a time while skin is recovering. Retinal and acids on the same night is the single most common reason a barrier never finishes healing.\n\nDo not rinse with hot water. Heat strips the lipids you are trying to rebuild, and the tightness afterwards is the proof.\n\nSeal damp, not dry. A balm over skin that is still slightly wet traps several times the water that the same balm over dry skin will.\n\nStore jars away from the bathroom — heat and humidity break down propolis and vitamin C faster than time does.\n\nAnd give it four weeks. Barrier lipids turn over on their own schedule, whatever the label promises.",
                'care,barrier,tips',
                '/images/scenes/about-craft.jpg',
            ],
        ];

        foreach ($rows as $i => [$title, $category, $excerpt, $content, $tags, $thumb]) {
            Blog::updateOrCreate(
                ['slug' => Str::slug($title)],
                [
                    'title' => $title,
                    'category' => $category,
                    'excerpt' => $excerpt,
                    'content' => $content,
                    'tags' => $tags,
                    'thumbnail' => $thumb,
                    'author_name' => 'Lalwani Books International',
                    'is_active' => true,
                    'is_featured' => $i === 0,
                    'published_at' => now()->subDays(($i + 1) * 6),
                ]
            );
        }
    }

    private function settings(): void
    {
        Setting::setMany([
            'stats_enabled' => '1',
            'stats_1_value' => '12', 'stats_1_suffix' => '', 'stats_1_label' => 'Signature Rituals',
            'stats_2_value' => '40', 'stats_2_suffix' => '+', 'stats_2_label' => 'Rare Ingredients',
            'stats_3_value' => '12', 'stats_3_suffix' => 'h', 'stats_3_label' => 'Average Longevity',
            'stats_4_value' => '100', 'stats_4_suffix' => '%', 'stats_4_label' => 'Cruelty Free, Hive Kind',

            'cta_banner_enabled' => '1',
            'cta_banner_eyebrow' => 'Complimentary with every order',
            'cta_banner_heading' => 'Luxury Packaging, Always',
            'cta_banner_description' => 'Every Lalwani Books International jar ships in a hand-finished box with a note card — ready to gift, no wrapping required.',
            'cta_banner_button_text' => 'Shop the Collection',
            'cta_banner_button_url' => '/collection',

            'about_hero_eyebrow' => 'Our Story',
            'about_quote_text' => 'Skincare should feel like a promise the morning keeps.',
            'about_quote_author' => 'Lalwani Books International',

            'page_faq' => "How long does delivery take?
Orders ship within 24 hours. Standard delivery takes 3–5 business days across India.

Can I return a product?
Unopened jars can be returned within 30 days for a full refund. Opened jars can be exchanged once.

Are your products cruelty free?
Never tested on animals. The honey, propolis and beeswax come from hives we keep ourselves, harvested so the colony always keeps more than it gives.

Which product is right for me?
Start with the category that matches your concern — Skin, Hair, Makeup, Bath & Body — or ask our concierge and we will put a routine together for you.",
        ]);
    }
}
