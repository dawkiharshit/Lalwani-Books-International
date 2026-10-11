<?php

namespace Tests\Feature;

use App\Models\Blog;
use App\Models\Setting;
use App\Support\HtmlSanitizer;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * Admin-written HTML reaches shoppers cleaned, and every API answer carries
 * the baseline security headers.
 *
 * Runs inside a rolled-back transaction, so it needs an already-migrated
 * database (the default in-memory SQLite has no tables), e.g.:
 *   DB_CONNECTION=mysql DB_DATABASE=lalwani_books_test php artisan test --filter=SecurityHardeningTest
 */
class SecurityHardeningTest extends TestCase
{
    use DatabaseTransactions;

    private const NASTY = '<p onclick="steal()">Hello <strong>readers</strong></p>'
        .'<script>alert(1)</script><img src="x" onerror="alert(2)"><img src="javascript:alert(3)">'
        .'<a href="javascript:alert(4)">bad</a><a href="https://example.com" target="_blank">good</a>'
        .'<iframe src="https://evil.test"></iframe><style>body{display:none}</style>'
        .'<a href="java&#10;script:alert(5)">tricky</a><p style="position:fixed">styled</p>';

    public function test_the_cleaner_keeps_formatting_and_drops_anything_that_runs(): void
    {
        $clean = HtmlSanitizer::clean(self::NASTY);

        $this->assertStringContainsString('<strong>readers</strong>', $clean);
        $this->assertStringContainsString('href="https://example.com"', $clean);
        $this->assertStringContainsString('rel="noopener noreferrer"', $clean);
        foreach (['<script', 'onclick', 'onerror', 'javascript:', '<iframe', '<style', 'style=', 'alert('] as $bad) {
            $this->assertStringNotContainsStringIgnoringCase($bad, $clean, "still contains {$bad}");
        }
        $this->assertSame('Café — नमस्ते', strip_tags(HtmlSanitizer::clean('<p>Café — नमस्ते</p>')));
    }

    public function test_a_blog_post_reaches_the_shop_cleaned(): void
    {
        Blog::create([
            'title' => 'Security check post',
            'slug' => 'security-check-post-'.uniqid(),
            'content' => self::NASTY,
            'is_active' => true,
            'published_at' => now()->subDay(),
        ]);
        $slug = Blog::query()->latest('id')->value('slug');

        $content = $this->getJson("/api/v1/blogs/{$slug}")->assertOk()->json('data.content');

        $this->assertStringContainsString('<strong>readers</strong>', $content);
        $this->assertStringNotContainsStringIgnoringCase('<script', $content);
        $this->assertStringNotContainsStringIgnoringCase('onerror', $content);
    }

    public function test_the_about_story_reaches_the_shop_cleaned(): void
    {
        Setting::set('about_founder_story', self::NASTY);

        $story = $this->getJson('/api/v1/settings')->assertOk()->json('data.about_founder_story');

        $this->assertStringContainsString('<strong>readers</strong>', $story);
        $this->assertStringNotContainsStringIgnoringCase('<script', $story);
        $this->assertStringNotContainsStringIgnoringCase('javascript:', $story);
    }

    public function test_api_answers_carry_the_security_headers(): void
    {
        $this->getJson('/api/v1/settings')
            ->assertOk()
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'DENY')
            ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
            ->assertHeaderMissing('X-Powered-By');
    }
}
