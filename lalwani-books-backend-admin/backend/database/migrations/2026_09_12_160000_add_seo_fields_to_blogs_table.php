<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('blogs', function (Blueprint $table) {
            // On-page SEO (meta_title / meta_description already exist).
            $table->string('focus_keyword')->nullable()->after('meta_description');
            $table->string('meta_keywords')->nullable()->after('focus_keyword');
            $table->string('canonical_url')->nullable()->after('meta_keywords');
            $table->boolean('noindex')->default(false)->after('canonical_url');
            $table->boolean('nofollow')->default(false)->after('noindex');

            // Off-page / social — how the post looks when shared off-site.
            $table->string('og_title')->nullable()->after('nofollow');
            $table->text('og_description')->nullable()->after('og_title');
            $table->string('og_image')->nullable()->after('og_description');
            $table->string('twitter_card')->default('summary_large_image')->after('og_image');
        });
    }

    public function down(): void
    {
        Schema::table('blogs', function (Blueprint $table) {
            $table->dropColumn([
                'focus_keyword', 'meta_keywords', 'canonical_url', 'noindex', 'nofollow',
                'og_title', 'og_description', 'og_image', 'twitter_card',
            ]);
        });
    }
};
