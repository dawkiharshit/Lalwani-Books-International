<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('zodiac_sign', 20)->index();
            $table->string('sign_dates', 40)->nullable();
            $table->string('tagline')->nullable();
            $table->text('description');
            $table->decimal('price', 8, 2);
            $table->decimal('compare_at_price', 8, 2)->nullable();
            $table->unsignedInteger('stock')->default(100);
            $table->string('sku', 40)->unique();
            $table->unsignedSmallInteger('size_ml')->default(100);
            $table->decimal('rating_avg', 3, 2)->default(0);
            $table->unsignedInteger('rating_count')->default(0);
            $table->boolean('is_featured')->default(false);
            $table->boolean('is_bestseller')->default(false);
            $table->boolean('is_active')->default(true);
            $table->string('color_from', 10);
            $table->string('color_to', 10);
            $table->string('accent', 10);
            $table->string('notes_top');
            $table->string('notes_heart');
            $table->string('notes_base');
            $table->timestamps();
            $table->index(['is_active', 'is_bestseller']);
            $table->index(['is_active', 'is_featured']);
            $table->index('price');
        });

        Schema::create('product_images', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('path');
            $table->string('alt')->nullable();
            $table->unsignedSmallInteger('sort')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_images');
        Schema::dropIfExists('products');
    }
};
