<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Admin-editable overrides for the twelve rashis: the signature perfume
 * mapping and the copy (traits, ruling planet, description). The fixed
 * astrology facts (dates, element, detection ranges) stay in code.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('zodiac_signs', function (Blueprint $table) {
            $table->id();
            $table->string('sign', 20)->unique(); // English key, e.g. "Aries"
            $table->string('traits', 190)->nullable();
            $table->string('ruling_planet', 60)->nullable();
            $table->text('description')->nullable();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->timestamps();
        });

        // Seed the twelve rows from the facts already shipped in code so the
        // admin starts with the current copy, editable from here on.
        $seed = [
            ['Aries', 'Bold, ambitious, passionate', 'Mangal (Mars)'],
            ['Taurus', 'Grounded, devoted, indulgent', 'Shukra (Venus)'],
            ['Gemini', 'Curious, witty, expressive', 'Budh (Mercury)'],
            ['Cancer', 'Intuitive, tender, protective', 'Chandra (Moon)'],
            ['Leo', 'Radiant, regal, generous', 'Surya (Sun)'],
            ['Virgo', 'Precise, thoughtful, refined', 'Budh (Mercury)'],
            ['Libra', 'Harmonious, charming, elegant', 'Shukra (Venus)'],
            ['Scorpio', 'Magnetic, intense, mysterious', 'Mangal (Mars)'],
            ['Sagittarius', 'Adventurous, free, optimistic', 'Guru (Jupiter)'],
            ['Capricorn', 'Timeless, disciplined, noble', 'Shani (Saturn)'],
            ['Aquarius', 'Visionary, original, electric', 'Shani (Saturn)'],
            ['Pisces', 'Dreamy, artistic, empathic', 'Guru (Jupiter)'],
        ];

        $now = now();
        DB::table('zodiac_signs')->insert(array_map(fn ($r) => [
            'sign' => $r[0],
            'traits' => $r[1],
            'ruling_planet' => $r[2],
            'description' => null,
            'product_id' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ], $seed));
    }

    public function down(): void
    {
        Schema::dropIfExists('zodiac_signs');
    }
};
