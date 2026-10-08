<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Content tables ported from the arpita reference backend:
     * gallery, collection circles, new arrivals, instagram feed and blog posts.
     * Schemas kept identical to the reference so the admin behaves the same way.
     */
    public function up(): void
    {
        // Simple "image + label + link" blocks (arpita: gallery_items,
        // collection_circles, new_arrivals, instagram_posts).
        foreach (['gallery_items', 'collection_circles', 'new_arrivals'] as $table) {
            Schema::create($table, function (Blueprint $t) use ($table) {
                $t->id();
                $t->string('image_path');
                if ($table === 'gallery_items') {
                    $t->string('caption')->nullable();
                } else {
                    $t->string('title');
                    $t->string('link_url')->nullable();
                }
                $t->boolean('is_active')->default(true);
                $t->integer('sort_order')->default(0);
                $t->timestamps();
                $t->softDeletes();
                $t->index('is_active');
            });
        }

        Schema::create('instagram_posts', function (Blueprint $table) {
            $table->id();
            $table->string('image_path');
            $table->string('post_url')->nullable();
            $table->string('caption')->nullable();
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
            $table->softDeletes();
            $table->index('is_active');
        });

        Schema::create('blogs', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('slug')->unique();
            $table->text('excerpt')->nullable();
            $table->longText('content');
            $table->string('thumbnail')->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('author_name')->nullable();
            $table->string('category')->nullable();
            $table->string('tags')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('is_featured')->default(false);
            $table->timestamp('published_at')->nullable();
            $table->string('meta_title')->nullable();
            $table->text('meta_description')->nullable();
            $table->unsignedInteger('views')->default(0);
            $table->timestamps();
            $table->softDeletes();
            $table->index(['is_active', 'published_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('blogs');
        Schema::dropIfExists('instagram_posts');
        Schema::dropIfExists('new_arrivals');
        Schema::dropIfExists('collection_circles');
        Schema::dropIfExists('gallery_items');
    }
};
