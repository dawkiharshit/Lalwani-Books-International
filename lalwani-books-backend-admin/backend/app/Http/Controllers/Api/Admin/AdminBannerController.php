<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Banner;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Hero banner management — CRUD plus the three cover images each banner can
 * carry (front, left, right), which the storefront fans out as a stack.
 */
class AdminBannerController extends Controller
{
    /** Upload field => column, in stack order. */
    private const SLOTS = [
        'image' => 'image_path',
        'image_2' => 'image_2_path',
        'image_3' => 'image_3_path',
    ];

    public function index()
    {
        return response()->json([
            'data' => Banner::orderBy('sort_order')->get()->map->toArray()->values(),
        ]);
    }

    /** Single banner for the admin edit page. */
    public function show(Banner $banner)
    {
        return response()->json(['data' => $banner->toArray()]);
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);

        foreach (self::SLOTS as $field => $column) {
            if ($request->hasFile($field)) {
                $data[$column] = 'storage/'.$request->file($field)->store('banners', 'public');
            }
            unset($data[$field]);
        }

        $data['is_active'] = $request->boolean('is_active', true);
        $data['show_text'] = $request->boolean('show_text', true);
        $data['sort_order'] = (int) ($data['sort_order'] ?? Banner::max('sort_order') + 1);

        $banner = Banner::create($data);

        return response()->json(['data' => $banner->toArray()], 201);
    }

    public function update(Request $request, Banner $banner)
    {
        $data = $this->validated($request);

        // Each cover slot: a new file replaces the old one, a `remove_<field>`
        // flag clears it, and silence leaves it as it is.
        $covers = [];
        foreach (self::SLOTS as $field => $column) {
            if ($request->hasFile($field)) {
                $this->deleteFile($banner->$column);
                $covers[$column] = 'storage/'.$request->file($field)->store('banners', 'public');
            } elseif ($request->boolean('remove_'.$field)) {
                $this->deleteFile($banner->$column);
                $covers[$column] = null;
            }
            unset($data[$field]);
        }

        if ($request->has('is_active')) {
            $data['is_active'] = $request->boolean('is_active');
        }
        if ($request->has('show_text')) {
            $data['show_text'] = $request->boolean('show_text');
        }

        // Keep only keys the request actually sent, so a partial update (e.g.
        // just is_active) never wipes the other fields — while an explicitly
        // blank field DOES clear that value. The cover changes are added after
        // the intersect: the request carries the files, never the columns.
        $payload = array_intersect_key($data, array_flip($request->keys())) + $covers;

        $banner->update($payload);

        return response()->json(['data' => $banner->fresh()->toArray()]);
    }

    public function destroy(Banner $banner)
    {
        foreach (self::SLOTS as $column) {
            $this->deleteFile($banner->$column);
        }
        $banner->delete();

        return response()->json(['message' => 'Banner deleted.']);
    }

    private function validated(Request $request): array
    {
        $image = ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'];

        return $request->validate([
            'title' => ['nullable', 'string', 'max:190'],
            'subtitle' => ['nullable', 'string', 'max:190'],
            'badge_text' => ['nullable', 'string', 'max:40'],
            'description' => ['nullable', 'string', 'max:1000'],
            'button_text' => ['nullable', 'string', 'max:60'],
            // A page on this site or an http(s) address — never javascript: or data:.
            'button_url' => ['nullable', 'string', 'max:500', new \App\Rules\SafeLink],
            'sort_order' => ['nullable', 'integer'],
            'show_text' => ['nullable', 'boolean'],
            'image' => $image,
            'image_2' => $image,
            'image_3' => $image,
            'remove_image' => ['nullable', 'boolean'],
            'remove_image_2' => ['nullable', 'boolean'],
            'remove_image_3' => ['nullable', 'boolean'],
        ]);
    }

    /** Remove an uploaded file; frontend-bundled /images/... paths are never touched. */
    private function deleteFile(?string $path): void
    {
        if ($path && str_starts_with($path, 'storage/')) {
            Storage::disk('public')->delete(substr($path, strlen('storage/')));
        }
    }
}
