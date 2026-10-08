<?php

namespace Database\Seeders;

use App\Models\Banner;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * A starter bookstore catalogue so the storefront has something to show.
 *
 *   php artisan db:seed --class=BookSeeder
 *
 * Real, well-known titles with indicative prices. Ratings start at zero and no
 * reviews or testimonials are invented — those come from real customers. Edit
 * or archive any of it in admin → Products; re-running only adds what is
 * missing and never overwrites a book you have edited.
 *
 * It also removes the twelve zodiac categories an old migration created, but
 * only while they hold no products.
 */
class BookSeeder extends Seeder
{
    private const ZODIAC = [
        'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
        'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
    ];

    /** slug => [name, tagline, description] */
    private const CATEGORIES = [
        'fiction' => ['Fiction', 'Novels and stories', 'Literary and popular fiction from India and around the world.'],
        'indian-literature' => ['Indian Literature', 'Voices from home', 'Classic and contemporary Indian writing, in English and in translation.'],
        'children' => ["Children's Books", 'Stories for young readers', 'Picture books, early readers and chapter books for every age.'],
        'academic' => ['Academic & Education', 'Textbooks and reference', 'School and college textbooks, reference works and study guides.'],
        'competitive-exams' => ['Competitive Exams', 'Prepare with confidence', 'Preparation books for UPSC, SSC, banking, JEE, NEET and more.'],
        'business' => ['Business & Economics', 'Ideas that work', 'Management, finance, economics and entrepreneurship.'],
        'self-help' => ['Self-Help', 'Grow every day', 'Habits, productivity, wellbeing and personal growth.'],
        'science' => ['Science & Technology', 'How the world works', 'Popular science, computing and engineering.'],
    ];

    public function run(): void
    {
        Category::whereIn('slug', self::ZODIAC)->doesntHave('products')->delete();

        $ids = [];
        $sort = 0;
        foreach (self::CATEGORIES as $slug => [$name, $tagline, $description]) {
            $cat = Category::firstOrCreate(
                ['slug' => $slug],
                ['name' => $name, 'tagline' => $tagline, 'description' => $description, 'sort_order' => $sort]
            );
            $ids[$slug] = $cat->id;
            $sort++;
        }

        foreach ($this->books() as $i => $b) {
            $slug = Str::slug($b['name']);
            if (Product::where('slug', $slug)->exists()) {
                continue;
            }
            [$from, $to, $accent] = $b['colors'];
            Product::create([
                'category_id' => $ids[$b['cat']],
                'name' => $b['name'],
                'slug' => $slug,
                'author' => $b['author'],
                'publisher' => $b['publisher'],
                'isbn' => $b['isbn'] ?? null,
                'pages' => $b['pages'],
                'language' => $b['language'] ?? 'English',
                'binding' => $b['binding'] ?? 'Paperback',
                'published_year' => $b['year'],
                'tagline' => $b['tagline'],
                'description' => $b['description'],
                'price' => $b['price'],
                'compare_at_price' => $b['mrp'] ?? null,
                'stock' => 40,
                'sku' => sprintf('LBI-B%03d', $i + 1),
                'hsn_code' => '4901',
                'weight_grams' => $b['weight'] ?? 400,
                'is_bestseller' => $b['bestseller'] ?? false,
                'is_new_arrival' => $b['new'] ?? false,
                'is_featured' => $b['featured'] ?? false,
                'is_category_pick' => $b['pick'] ?? false,
                'is_active' => true,
                'color_from' => $from,
                'color_to' => $to,
                'accent' => $accent,
            ]);
        }

        if (! Banner::exists()) {
            Banner::create([
                'title' => 'Books For Every Reader',
                'subtitle' => 'Every Reader',
                'badge_text' => 'Lalwani Books International',
                'description' => 'Fiction, academic, children’s and competitive-exam books — genuine editions, delivered across India.',
                'button_text' => 'Shop Now',
                'button_url' => '/collection',
                'show_text' => true,
                'is_active' => true,
                'sort_order' => 0,
            ]);
            Banner::create([
                'title' => 'Bulk Orders For Schools & Libraries',
                'subtitle' => 'Schools & Libraries',
                'badge_text' => 'Institutions',
                'description' => 'Dedicated support for institutional and recurring orders. Tell us what you need.',
                'button_text' => 'Contact Us',
                'button_url' => '/contact',
                'show_text' => true,
                'is_active' => true,
                'sort_order' => 1,
            ]);
        }
    }

    private function books(): array
    {
        return [
            // Fiction
            ['cat' => 'fiction', 'name' => 'The Alchemist', 'author' => 'Paulo Coelho', 'publisher' => 'HarperCollins', 'isbn' => '9780062315007', 'pages' => 208, 'year' => 2014,
                'tagline' => 'A fable about following your dream', 'price' => 299, 'mrp' => 399, 'bestseller' => true, 'featured' => true, 'pick' => true, 'colors' => ['#F59E0B', '#B45309', '#FEF3C7'],
                'description' => 'Santiago, an Andalusian shepherd boy, travels from Spain to the Egyptian desert in search of a treasure buried near the Pyramids — and learns to listen to his heart along the way.'],
            ['cat' => 'fiction', 'name' => 'To Kill a Mockingbird', 'author' => 'Harper Lee', 'publisher' => 'Penguin Random House', 'pages' => 336, 'year' => 2015,
                'tagline' => 'A classic of courage and conscience', 'price' => 349, 'mrp' => 450, 'bestseller' => true, 'colors' => ['#475569', '#1E293B', '#FCD34D'],
                'description' => 'Through the eyes of young Scout Finch, a story of racial injustice and moral growth in a small Alabama town during the 1930s.'],
            ['cat' => 'fiction', 'name' => 'Nineteen Eighty-Four', 'author' => 'George Orwell', 'publisher' => 'Penguin Random House', 'pages' => 336, 'year' => 2008,
                'tagline' => 'Big Brother is watching', 'price' => 225, 'mrp' => 299, 'pick' => true, 'colors' => ['#DC2626', '#7F1D1D', '#FECACA'],
                'description' => 'Winston Smith works for the Ministry of Truth in a totalitarian state where independent thought is a crime. A defining novel of the twentieth century.'],
            ['cat' => 'fiction', 'name' => 'Pride and Prejudice', 'author' => 'Jane Austen', 'publisher' => 'Penguin Classics', 'pages' => 480, 'year' => 2003,
                'tagline' => 'The original love story', 'price' => 199, 'new' => true, 'colors' => ['#BE185D', '#831843', '#FBCFE8'],
                'description' => 'Elizabeth Bennet and the proud Mr Darcy misjudge each other at every turn in Austen’s sparkling comedy of manners.'],
            // Indian Literature
            ['cat' => 'indian-literature', 'name' => 'Malgudi Days', 'author' => 'R. K. Narayan', 'publisher' => 'Penguin Random House India', 'pages' => 256, 'year' => 2006,
                'tagline' => 'Stories from a small South Indian town', 'price' => 250, 'mrp' => 299, 'bestseller' => true, 'pick' => true, 'colors' => ['#0D9488', '#134E4A', '#99F6E4'],
                'description' => 'Thirty-two stories set in the fictional town of Malgudi, full of gentle humour and sharp observation of ordinary lives.'],
            ['cat' => 'indian-literature', 'name' => 'Gitanjali', 'author' => 'Rabindranath Tagore', 'publisher' => 'Rupa Publications', 'pages' => 112, 'year' => 2002,
                'tagline' => 'Song offerings', 'price' => 150, 'pick' => true, 'colors' => ['#CA8A04', '#713F12', '#FEF08A'],
                'description' => 'The collection of devotional poems that won Tagore the Nobel Prize in Literature in 1913.'],
            ['cat' => 'indian-literature', 'name' => 'The God of Small Things', 'author' => 'Arundhati Roy', 'publisher' => 'Penguin Random House India', 'pages' => 352, 'year' => 2002,
                'tagline' => 'Booker Prize winner', 'price' => 399, 'mrp' => 499, 'featured' => true, 'colors' => ['#16A34A', '#14532D', '#BBF7D0'],
                'description' => 'Twins Rahel and Estha grow up in Kerala in 1969, in a family where small things shift into large consequences.'],
            ['cat' => 'indian-literature', 'name' => 'Godaan', 'author' => 'Munshi Premchand', 'publisher' => 'Rajkamal Prakashan', 'pages' => 320, 'year' => 2016, 'language' => 'Hindi',
                'tagline' => 'Premchand’s masterpiece', 'price' => 275, 'new' => true, 'colors' => ['#9A3412', '#431407', '#FED7AA'],
                'description' => 'The struggles of Hori, a poor farmer, and his dream of owning a cow — a landmark of Hindi literature.'],
            // Children
            ['cat' => 'children', 'name' => 'The Panchatantra', 'author' => 'Vishnu Sharma', 'publisher' => 'Rupa Publications', 'pages' => 192, 'year' => 2010, 'binding' => 'Hardcover',
                'tagline' => 'Timeless fables for young readers', 'price' => 350, 'mrp' => 450, 'new' => true, 'pick' => true, 'colors' => ['#7C3AED', '#4C1D95', '#DDD6FE'],
                'description' => 'Classic animal fables that teach wisdom, friendship and good sense — retold for children.'],
            ['cat' => 'children', 'name' => 'Charlotte’s Web', 'author' => 'E. B. White', 'publisher' => 'HarperCollins', 'pages' => 192, 'year' => 2012,
                'tagline' => 'Some pig. Some spider.', 'price' => 299, 'bestseller' => true, 'colors' => ['#65A30D', '#365314', '#D9F99D'],
                'description' => 'Wilbur the pig and Charlotte the spider form a friendship that changes everything on the Zuckerman farm.'],
            ['cat' => 'children', 'name' => 'The Jungle Book', 'author' => 'Rudyard Kipling', 'publisher' => 'Puffin Classics', 'pages' => 240, 'year' => 2015,
                'tagline' => 'Mowgli’s adventures in the jungle', 'price' => 199, 'colors' => ['#15803D', '#052E16', '#FDE047'],
                'description' => 'Raised by wolves in the Indian jungle, Mowgli learns its laws from Baloo the bear and Bagheera the panther.'],
            // Academic
            ['cat' => 'academic', 'name' => 'Concepts of Physics Vol. 1', 'author' => 'H. C. Verma', 'publisher' => 'Bharati Bhawan', 'pages' => 464, 'year' => 2022, 'weight' => 700,
                'tagline' => 'The standard for senior secondary physics', 'price' => 525, 'bestseller' => true, 'featured' => true, 'pick' => true, 'colors' => ['#2563EB', '#1E3A8A', '#BFDBFE'],
                'description' => 'A clear, rigorous introduction to mechanics, waves and thermodynamics, with worked examples and exercises.'],
            ['cat' => 'academic', 'name' => 'Mathematics for Class 12', 'author' => 'R. D. Sharma', 'publisher' => 'Dhanpat Rai Publications', 'pages' => 1400, 'year' => 2024, 'weight' => 1500,
                'tagline' => 'Complete CBSE syllabus coverage', 'price' => 850, 'mrp' => 950, 'new' => true, 'colors' => ['#0891B2', '#164E63', '#A5F3FC'],
                'description' => 'Comprehensive theory, solved examples and graded exercises covering the full Class 12 mathematics syllabus.'],
            ['cat' => 'academic', 'name' => 'Oxford Advanced Learner’s Dictionary', 'author' => 'A. S. Hornby', 'publisher' => 'Oxford University Press', 'pages' => 1900, 'year' => 2020, 'weight' => 1800,
                'tagline' => 'The world’s bestselling advanced learner’s dictionary', 'price' => 795, 'mrp' => 895, 'colors' => ['#1D4ED8', '#172554', '#FDE68A'],
                'description' => 'Definitions, examples and usage notes for learners of English, with a focus on academic vocabulary.'],
            // Competitive exams
            ['cat' => 'competitive-exams', 'name' => 'Indian Polity', 'author' => 'M. Laxmikanth', 'publisher' => 'McGraw Hill', 'pages' => 1000, 'year' => 2023, 'weight' => 1300,
                'tagline' => 'For civil services examinations', 'price' => 795, 'mrp' => 895, 'bestseller' => true, 'pick' => true, 'colors' => ['#EA580C', '#7C2D12', '#FED7AA'],
                'description' => 'The standard reference on the Indian Constitution and political system for UPSC and state services aspirants.'],
            ['cat' => 'competitive-exams', 'name' => 'Quantitative Aptitude for Competitive Examinations', 'author' => 'R. S. Aggarwal', 'publisher' => 'S. Chand Publishing', 'pages' => 900, 'year' => 2023, 'weight' => 1100,
                'tagline' => 'Thousands of solved problems', 'price' => 640, 'new' => true, 'colors' => ['#E11D48', '#881337', '#FECDD3'],
                'description' => 'Topic-wise theory and practice questions for banking, SSC, railway and other competitive exams.'],
            ['cat' => 'competitive-exams', 'name' => 'Word Power Made Easy', 'author' => 'Norman Lewis', 'publisher' => 'Penguin Random House', 'pages' => 528, 'year' => 2015,
                'tagline' => 'Build a better vocabulary', 'price' => 199, 'mrp' => 250, 'colors' => ['#9333EA', '#3B0764', '#F5D0FE'],
                'description' => 'A complete course in vocabulary building that has helped generations of students and exam-takers.'],
            // Business
            ['cat' => 'business', 'name' => 'Rich Dad Poor Dad', 'author' => 'Robert T. Kiyosaki', 'publisher' => 'Plata Publishing', 'pages' => 336, 'year' => 2017,
                'tagline' => 'What the rich teach their kids about money', 'price' => 399, 'mrp' => 499, 'bestseller' => true, 'pick' => true, 'colors' => ['#7E22CE', '#3B0764', '#FACC15'],
                'description' => 'The story of two fathers and two very different attitudes to money, work and building wealth.'],
            ['cat' => 'business', 'name' => 'The Psychology of Money', 'author' => 'Morgan Housel', 'publisher' => 'Jaico Publishing House', 'pages' => 252, 'year' => 2020,
                'tagline' => 'Timeless lessons on wealth, greed and happiness', 'price' => 349, 'mrp' => 399, 'new' => true, 'featured' => true, 'colors' => ['#57534E', '#1C1917', '#FDE68A'],
                'description' => 'Nineteen short stories about the strange ways people think about money, and how to make better decisions with it.'],
            ['cat' => 'business', 'name' => 'Zero to One', 'author' => 'Peter Thiel', 'publisher' => 'Virgin Books', 'pages' => 224, 'year' => 2015,
                'tagline' => 'Notes on startups, or how to build the future', 'price' => 450, 'colors' => ['#0F172A', '#020617', '#38BDF8'],
                'description' => 'A contrarian look at innovation and how new companies create value that did not exist before.'],
            // Self-help
            ['cat' => 'self-help', 'name' => 'Atomic Habits', 'author' => 'James Clear', 'publisher' => 'Penguin Random House', 'pages' => 320, 'year' => 2018,
                'tagline' => 'Tiny changes, remarkable results', 'price' => 499, 'mrp' => 799, 'bestseller' => true, 'featured' => true, 'pick' => true, 'colors' => ['#F97316', '#9A3412', '#FFEDD5'],
                'description' => 'A practical framework for building good habits and breaking bad ones, one small change at a time.'],
            ['cat' => 'self-help', 'name' => 'Ikigai', 'author' => 'Héctor García & Francesc Miralles', 'publisher' => 'Penguin Random House', 'pages' => 208, 'year' => 2017, 'binding' => 'Hardcover',
                'tagline' => 'The Japanese secret to a long and happy life', 'price' => 399, 'mrp' => 499, 'new' => true, 'colors' => ['#DC2626', '#450A0A', '#FECACA'],
                'description' => 'What the residents of Okinawa can teach us about purpose, community and living well.'],
            ['cat' => 'self-help', 'name' => 'Wings of Fire', 'author' => 'A. P. J. Abdul Kalam', 'publisher' => 'Universities Press', 'pages' => 196, 'year' => 1999,
                'tagline' => 'An autobiography', 'price' => 275, 'bestseller' => true, 'colors' => ['#0284C7', '#0C4A6E', '#FDE047'],
                'description' => 'The life of India’s missile man and former President, from Rameswaram to the space and defence programmes.'],
            // Science
            ['cat' => 'science', 'name' => 'A Brief History of Time', 'author' => 'Stephen Hawking', 'publisher' => 'Bantam', 'pages' => 256, 'year' => 1998,
                'tagline' => 'From the Big Bang to black holes', 'price' => 399, 'mrp' => 499, 'pick' => true, 'colors' => ['#1E1B4B', '#0F0A2E', '#A5B4FC'],
                'description' => 'Hawking’s landmark account of space, time and the origins of the universe, written for the general reader.'],
            ['cat' => 'science', 'name' => 'Sapiens', 'author' => 'Yuval Noah Harari', 'publisher' => 'Vintage', 'pages' => 512, 'year' => 2015,
                'tagline' => 'A brief history of humankind', 'price' => 499, 'mrp' => 599, 'bestseller' => true, 'new' => true, 'colors' => ['#B91C1C', '#450A0A', '#FDE68A'],
                'description' => 'How Homo sapiens came to dominate the planet — from the cognitive revolution to the present day.'],
            ['cat' => 'science', 'name' => 'Clean Code', 'author' => 'Robert C. Martin', 'publisher' => 'Pearson', 'pages' => 464, 'year' => 2008, 'weight' => 750,
                'tagline' => 'A handbook of agile software craftsmanship', 'price' => 699, 'mrp' => 899, 'colors' => ['#334155', '#0F172A', '#86EFAC'],
                'description' => 'Principles, patterns and practices for writing code that is easy to read, change and maintain.'],
        ];
    }
}
