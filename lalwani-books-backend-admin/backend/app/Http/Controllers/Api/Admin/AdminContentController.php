<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\CollectionCircle;
use App\Models\GalleryItem;
use App\Models\InstagramPost;
use App\Models\NewArrival;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * One endpoint family for the four image-block content types the arpita admin
 * exposes separately: gallery, collection circles, new arrivals, instagram.
 * They share the same shape (image + label + link + active + order), so they
 * share one controller keyed by {type}.
 */
class AdminContentController extends Controller
{
    private const TYPES = [
        'gallery' => [
            'model' => GalleryItem::class,
            'dir' => 'gallery',
            'fields' => ['caption' => 'nullable|string|max:190'],
        ],
        'circles' => [
            'model' => CollectionCircle::class,
            'dir' => 'circles',
            'fields' => ['title' => 'required|string|max:120', 'link_url' => 'nullable|string|max:500'],
        ],
        'arrivals' => [
            'model' => NewArrival::class,
            'dir' => 'arrivals',
            'fields' => ['title' => 'required|string|max:120', 'link_url' => 'nullable|string|max:500'],
        ],
        'instagram' => [
            'model' => InstagramPost::class,
            'dir' => 'instagram',
            'fields' => ['caption' => 'nullable|string|max:190', 'post_url' => 'nullable|string|max:500'],
        ],
    ];

    private function config(string $type): array
    {
        abort_unless(isset(self::TYPES[$type]), 404, 'Unknown content type.');

        return self::TYPES[$type];
    }

    public function index(string $type)
    {
        $cfg = $this->config($type);

        return response()->json([
            'data' => $cfg['model']::orderBy('sort_order')->get()->map->toArray()->values(),
        ]);
    }

    public function store(Request $request, string $type)
    {
        $cfg = $this->config($type);

        $data = $request->validate(array_merge($cfg['fields'], [
            'image' => 'required|image|mimes:jpg,jpeg,png,webp|max:4096',
            'sort_order' => 'nullable|integer',
        ]));

        $data['image_path'] = 'storage/'.$request->file('image')->store($cfg['dir'], 'public');
        $data['sort_order'] = (int) ($data['sort_order'] ?? $cfg['model']::max('sort_order') + 1);
        $data['is_active'] = true;
        unset($data['image']);

        $row = $cfg['model']::create($data);

        return response()->json(['data' => $row->toArray()], 201);
    }

    public function update(Request $request, string $type, int $id)
    {
        $cfg = $this->config($type);
        $row = $cfg['model']::findOrFail($id);

        // Only validate fields actually present — this endpoint doubles as the
        // active-toggle, which posts nothing but is_active.
        $rules = array_merge(
            collect($cfg['fields'])->map(fn ($r) => str_replace('required', 'sometimes', $r))->all(),
            ['image' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:4096', 'sort_order' => 'nullable|integer']
        );
        $data = $request->validate($rules);

        if ($request->hasFile('image')) {
            $this->deleteImage($row->image_path);
            $data['image_path'] = 'storage/'.$request->file('image')->store($cfg['dir'], 'public');
        }
        unset($data['image']);

        if ($request->has('is_active')) {
            $data['is_active'] = $request->boolean('is_active');
        }

        // Only touch keys the request sent — a partial update (image only,
        // toggle only) leaves the rest alone, but a blank field clears it.
        $payload = array_intersect_key($data, array_flip($request->keys()));
        if (isset($data['image_path'])) {
            $payload['image_path'] = $data['image_path'];
        }
        unset($payload['image']);

        $row->update($payload);

        return response()->json(['data' => $row->fresh()->toArray()]);
    }

    public function destroy(string $type, int $id)
    {
        $cfg = $this->config($type);
        $row = $cfg['model']::findOrFail($id);

        $this->deleteImage($row->image_path);
        $row->delete();

        return response()->json(['message' => 'Deleted.']);
    }

    private function deleteImage(?string $path): void
    {
        if ($path && str_starts_with($path, 'storage/')) {
            Storage::disk('public')->delete(substr($path, strlen('storage/')));
        }
    }
}
