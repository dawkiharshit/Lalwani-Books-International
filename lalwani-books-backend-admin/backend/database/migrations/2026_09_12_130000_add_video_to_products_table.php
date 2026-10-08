<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            // A YouTube (or other) link the admin pastes.
            $table->string('video_url')->nullable()->after('image');
            // An uploaded .mp4 stored on disk (storage/...); supersedes the link.
            $table->string('video_path')->nullable()->after('video_url');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['video_url', 'video_path']);
        });
    }
};
