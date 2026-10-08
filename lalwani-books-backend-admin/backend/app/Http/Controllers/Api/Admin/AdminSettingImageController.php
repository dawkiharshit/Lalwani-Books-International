<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Uploads for settings that hold an image path.
 *
 * One endpoint for all of them, gated by an allowlist — adding a new image
 * setting later is a one-line change here rather than a new controller.
 */
class AdminSettingImageController extends Controller
{
    /** setting key => storage sub-directory */
    private const KEYS = [
        'about_hero_image' => 'about',
        'about_founder_image' => 'about',
        // The three-photo collage beside the About block on the home page.
        'about_home_image_1' => 'about',
        'about_home_image_2' => 'about',
        'about_home_image_3' => 'about',
    ];

    public function store(Request $request, string $key)
    {
        abort_unless(isset(self::KEYS[$key]), 404, 'Unknown image setting.');

        $request->validate([
            'file' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
        ]);

        $this->deleteFile(Setting::get($key, ''));

        $path = $request->file('file')->store(self::KEYS[$key], 'public');
        Setting::set($key, '/storage/'.$path);

        return response()->json(['data' => [$key => Setting::get($key, '')]]);
    }

    public function destroy(string $key)
    {
        abort_unless(isset(self::KEYS[$key]), 404, 'Unknown image setting.');

        $this->deleteFile(Setting::get($key, ''));
        Setting::set($key, '');

        return response()->json(['data' => [$key => '']]);
    }

    /**
     * Only removes files this controller wrote. A path pointing at a bundled
     * asset (/images/...) is unlinked from the setting but left on disk.
     */
    private function deleteFile(?string $value): void
    {
        if (! $value) {
            return;
        }

        $path = ltrim(str_replace('/storage/', '', $value), '/');
        $dirs = array_unique(array_values(self::KEYS));

        foreach ($dirs as $dir) {
            if (str_starts_with($path, $dir.'/') && Storage::disk('public')->exists($path)) {
                Storage::disk('public')->delete($path);

                return;
            }
        }
    }
}
