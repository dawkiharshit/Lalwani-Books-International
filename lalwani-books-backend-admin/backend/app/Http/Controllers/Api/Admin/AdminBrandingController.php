<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Logo and favicon uploads — port of the arpita AdminBrandingController.
 *
 * The setting stores a root-relative "/storage/..." path so the Next.js
 * rewrite keeps the asset same-origin; the disk path is that value with the
 * "/storage/" prefix stripped.
 */
class AdminBrandingController extends Controller
{
    /** upload slug => setting key */
    private const FIELDS = [
        'logo' => 'site_logo',
        'favicon' => 'site_favicon',
    ];

    public function index()
    {
        return response()->json(['data' => [
            'site_name' => Setting::get('site_name', 'Lalwani Books International'),
            'site_tagline' => Setting::get('site_tagline', ''),
            'site_logo' => Setting::get('site_logo', ''),
            'site_favicon' => Setting::get('site_favicon', ''),
        ]]);
    }

    public function upload(Request $request, string $field)
    {
        abort_unless(isset(self::FIELDS[$field]), 404);

        /*
         * SVG is not accepted. An SVG is a document, not just a picture: it can
         * carry <script>, and while an <img> tag refuses to run that, anyone
         * opening the uploaded file's URL directly gets it executed on this
         * origin. Raster formats cannot do that. Re-allow it only alongside a
         * sanitiser that strips scripts and on* attributes on upload.
         */
        $request->validate($field === 'favicon'
            ? ['file' => ['required', 'file', 'mimes:png,ico,webp', 'max:512']]
            : ['file' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048']]);

        $key = self::FIELDS[$field];
        $this->deleteFile(Setting::get($key, ''));

        $path = $request->file('file')->store('branding', 'public');
        Setting::set($key, '/storage/'.$path);

        return $this->index();
    }

    public function destroy(string $field)
    {
        abort_unless(isset(self::FIELDS[$field]), 404);

        $key = self::FIELDS[$field];
        $this->deleteFile(Setting::get($key, ''));
        Setting::set($key, '');

        return $this->index();
    }

    /**
     * Only ever unlinks files this controller wrote. A logo pointing at a
     * hand-placed asset (say /storage/logo/lalwani-books-logo.png) is left alone —
     * the setting is cleared, the file stays.
     */
    private function deleteFile(?string $value): void
    {
        if (! $value) {
            return;
        }

        $path = ltrim(str_replace('/storage/', '', $value), '/');

        if (str_starts_with($path, 'branding/') && Storage::disk('public')->exists($path)) {
            Storage::disk('public')->delete($path);
        }
    }
}
