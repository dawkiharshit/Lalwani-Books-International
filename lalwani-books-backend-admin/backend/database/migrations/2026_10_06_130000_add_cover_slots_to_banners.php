<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A hero banner shows a fanned stack of three covers. The first slot is the
 * existing image_path; these two complete the stack. Slots left empty are
 * filled on the storefront with featured books' covers.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('banners', function (Blueprint $table) {
            $table->string('image_2_path')->nullable()->after('image_path');
            $table->string('image_3_path')->nullable()->after('image_2_path');
        });
    }

    public function down(): void
    {
        Schema::table('banners', function (Blueprint $table) {
            $table->dropColumn(['image_2_path', 'image_3_path']);
        });
    }
};
