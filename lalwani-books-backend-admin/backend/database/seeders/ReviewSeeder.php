<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Models\Review;
use Illuminate\Database\Seeder;

/**
 * Demo reviews, so product cards and the product page have a star rating to
 * show on a fresh install.
 *
 * Copy is picked per category: a body about "four weeks in and my texture has
 * changed" reads wrong on a hand-thrown ceramic pot, so each category gets its
 * own pool on top of the generic packaging-and-delivery lines.
 *
 * A product that already has a review is left alone, so this cannot bury a
 * real customer's words under seeded ones.
 */
class ReviewSeeder extends Seeder
{
    /**
     * slug => [target average, review count].
     *
     * The average is approximate: the run splits the count between 4s and 5s
     * in roughly the right proportion, which lands within about 0.05.
     */
    private const TARGETS = [
        // Skin
        'golden-hour-propolis-serum' => [4.9, 14],
        'velvet-royal-jelly-cream' => [4.8, 11],
        'dew-nectar-essence' => [4.6, 8],

        // Hair
        'honey-gloss-hair-mask' => [4.8, 12],
        'propolis-scalp-serum' => [4.7, 9],
        'beeswax-smoothing-balm' => [4.5, 6],

        // Makeup
        'nectar-tinted-lip-balm' => [4.7, 10],
        'golden-hour-highlighter' => [4.6, 7],
        'honeyed-skin-tint' => [4.5, 8],

        // Luxury Fragrance
        'amber-royale-edp' => [4.9, 11],
        'midnight-bloom-edp' => [4.8, 9],

        // Bath & Body
        'raw-honey-cleansing-bar' => [4.7, 12],
        'honeycomb-milk-bath-soak' => [4.8, 8],
        'beeswax-body-butter' => [4.6, 9],

        // Gifting
        'golden-ritual-set' => [4.9, 7],
        'discovery-six' => [4.7, 6],

        // Handicraft
        'hand-thrown-honey-pot' => [4.8, 5],
        'potters-wheel-vanity-tray' => [4.6, 4],
    ];

    /** Reads right whatever the product is. */
    private const GENERIC = [
        'The packaging is beautiful and everything arrived perfectly intact.',
        'Ordered on a Tuesday and had it by Thursday, packed with real care.',
        'Bought it as a gift and ended up ordering a second one for myself.',
        'Exactly what the description promised, which is rarer than it should be.',
        'Elegant and genuinely unusual. I have not found anything quite like it.',
    ];

    /** Keyed by category slug, as seeded by CategorySeeder. */
    private const BY_CATEGORY = [
        'skin' => [
            'Four weeks in and my texture has genuinely changed. Nothing else did that.',
            'A little goes a long way — one pump morning and night is plenty.',
            'No sting, no breakouts, and my usual dry patches have settled down.',
            'Light on the skin yet genuinely hydrating. Sits well under everything.',
            'My dermatologist asked what I had changed. This was the only thing.',
            'Absorbs in seconds and leaves no film behind at all.',
        ],
        'hair' => [
            'My ends stopped splitting within a month, and I only use it weekly.',
            'Soft hair without that heavy, coated feeling most masks leave behind.',
            'Two washes in and the frizz was already noticeably calmer.',
            'Smells faintly of honey and rinses out completely. No residue.',
            'My scalp stopped flaking, which nothing else had managed.',
            'Works on fine hair without weighing it down, which is the hard part.',
        ],
        'makeup' => [
            'Blends with a fingertip and never settles into fine lines.',
            'The colour looks natural in daylight, which is what sold me.',
            'Wears right through lunch without needing a touch up.',
            'Comfortable enough that I forget I am wearing it.',
            'Buildable — sheer for the office, heavier when I want it.',
            'Does not dry out my lips the way tinted balms usually do.',
        ],
        'fragrance' => [
            'Lasts the full working day on me, and I am usually unlucky with longevity.',
            'Warm without being heavy. I get asked about it every time I wear it.',
            'Opens bright and settles into something much softer after an hour.',
            'Unlike anything else I own, and I own far too many.',
            'Close to the skin rather than filling a room, which is what I wanted.',
            'The dry-down is the best part. Worth waiting twenty minutes for.',
        ],
        'bath-body' => [
            'Leaves my skin soft without a film, and it lasts far longer than expected.',
            'The whole bathroom smells of honey afterwards. Worth it for that alone.',
            'Gentle enough for my daughter, and she has very reactive skin.',
            'I have gone through three of these now. It replaced everything else.',
            'Rich enough for winter without feeling greasy in the morning.',
            'No tightness after a shower for the first time in years.',
        ],
        'gifting' => [
            'Gave this to my mother and she has already asked where to buy another.',
            'Arrived gift-wrapped and ready to hand over. No extra work at all.',
            'A genuinely thoughtful-looking present for the money.',
            'A good way to try several things before committing to full sizes.',
            'Every piece in it earned its place. Nothing felt like filler.',
            'The box alone got a reaction before anything was opened.',
        ],
        'handicraft' => [
            'You can feel it was made by hand. No two are quite alike, and that is the point.',
            'Heavier and far better finished than the photographs suggest.',
            'Sits on my dresser and gets commented on constantly.',
            'Well packed and arrived without a chip. A lovely piece.',
            'The glaze has depth to it that a photo cannot really carry.',
            'Practical as well as pretty, which I did not expect.',
        ],
    ];

    private const NAMES = [
        'Sophia M.', 'Isabella R.', 'Olivia K.', 'Emma T.', 'Ava L.',
        'Mia S.', 'Charlotte D.', 'Amelia P.', 'Harper W.', 'Evelyn C.',
        'Luna B.', 'Grace H.', 'Chloe N.', 'Zoe F.', 'Lily A.',
    ];

    private const TITLES = [
        'My holy grail step', 'Absolutely stunning', 'Worth every penny',
        'Compliments all day', 'A little luxury', 'Exceeded expectations',
        'Pure elegance', 'Exactly what I needed', 'Obsessed',
        'Repurchasing already', 'Better than expected', 'Quietly excellent',
    ];

    public function run(): void
    {
        $created = 0;
        $kept = [];

        foreach (self::TARGETS as $slug => [$avg, $count]) {
            $product = Product::with('category')->where('slug', $slug)->first();

            // Loudly — a catalogue rename once turned this whole seeder into a
            // silent no-op, and every product sat at "0.0 (0 reviews)".
            if (! $product) {
                $this->command?->warn("No product with slug '{$slug}' — skipping its reviews.");
                continue;
            }

            if ($product->reviews()->count() > 0) {
                // Its counters may be stale, and an unapproved review leaves
                // them at zero on purpose — recalculate either way.
                $product->recalculateRating();
                $kept[] = $slug;
                continue;
            }

            $bodies = array_merge(self::GENERIC, self::BY_CATEGORY[$product->category?->slug] ?? []);

            // 4s first, then 5s, in the proportion that lands on the target.
            $fours = (int) round($count * (5 - $avg));
            $offset = crc32($slug);
            $rows = [];

            for ($i = 0; $i < $count; $i++) {
                // Oldest first, roughly a review every couple of days.
                $when = now()->subDays($count * 3 - $i * 2);

                $rows[] = [
                    'product_id' => $product->id,
                    'user_id' => null,
                    'name' => self::NAMES[($i + $offset) % count(self::NAMES)],
                    'rating' => $i < $fours ? 4 : 5,
                    'title' => self::TITLES[($i + $offset) % count(self::TITLES)],
                    'body' => $bodies[($i + $offset) % count($bodies)],
                    'is_approved' => true,
                    'created_at' => $when,
                    'updated_at' => $when,
                ];
            }

            // insert(), not create(): created_at is not fillable, so mass
            // assignment silently dated every seeded review today.
            Review::insert($rows);
            $product->recalculateRating();
            $created += $count;
        }

        $this->command?->info("Seeded {$created} reviews.");

        if ($kept) {
            $this->command?->info('Already had reviews, left alone: '.implode(', ', $kept).'.');
        }
    }
}
