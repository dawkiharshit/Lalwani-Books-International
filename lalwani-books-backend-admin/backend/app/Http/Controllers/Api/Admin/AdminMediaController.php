<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductImage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Product image upload — the upload pattern ported from the arpita reference
 * backend (multipart -> store('products', 'public')), exposed as JSON API
 * endpoints for the Next.js admin panel.
 */
class AdminMediaController extends Controller
{
    /** Upload / replace the main product photo. Field: `file`. */
    public function storeThumbnail(Request $request, Product $product)
    {
        $request->validate([
            'file' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
        ]);

        // Remove the previous upload (never touches frontend-bundled /images/... paths)
        if ($product->image && str_starts_with($product->image, 'storage/')) {
            Storage::disk('public')->delete(substr($product->image, strlen('storage/')));
        }

        $path = $request->file('file')->store('products', 'public');
        $product->update(['image' => 'storage/'.$path]);

        return response()->json(['data' => $product->fresh()->load('category')->toDetail()], 201);
    }

    /** Clear the main photo (storefront falls back to the SVG bottle). */
    public function destroyThumbnail(Product $product)
    {
        if ($product->image && str_starts_with($product->image, 'storage/')) {
            Storage::disk('public')->delete(substr($product->image, strlen('storage/')));
        }
        $product->update(['image' => null]);

        return response()->json(['data' => $product->fresh()->load('category')->toDetail()]);
    }

    /** Add gallery images. Field: `files[]` (up to 6 per request). */
    public function storeGallery(Request $request, Product $product)
    {
        $request->validate([
            'files' => ['required', 'array', 'max:6'],
            'files.*' => ['image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
        ]);

        $sort = (int) $product->images()->max('sort');
        foreach ($request->file('files') as $file) {
            $product->images()->create([
                'path' => 'storage/'.$file->store('products', 'public'),
                'alt' => $product->name,
                'sort' => ++$sort,
            ]);
        }

        return response()->json(['data' => $product->fresh()->load(['category', 'images'])->toDetail()], 201);
    }

    /** Upload / replace the product video (.mp4). Field: `file`. Uploading a
     *  file supersedes any YouTube link the admin had saved. */
    public function storeVideo(Request $request, Product $product)
    {
        $request->validate([
            'file' => ['required', 'file', 'mimetypes:video/mp4,video/webm,video/quicktime', 'max:51200'],
        ], [], ['file' => 'video']);

        if ($product->video_path && str_starts_with($product->video_path, 'storage/')) {
            Storage::disk('public')->delete(substr($product->video_path, strlen('storage/')));
        }

        $path = $request->file('file')->store('products/videos', 'public');
        $product->update(['video_path' => 'storage/'.$path, 'video_url' => null]);

        return response()->json(['data' => $product->fresh()->load('category')->toDetail()], 201);
    }

    /** Remove the uploaded video (the storefront then shows no video, unless a
     *  YouTube link is set on the product form). */
    public function destroyVideo(Product $product)
    {
        if ($product->video_path && str_starts_with($product->video_path, 'storage/')) {
            Storage::disk('public')->delete(substr($product->video_path, strlen('storage/')));
        }
        $product->update(['video_path' => null]);

        return response()->json(['data' => $product->fresh()->load('category')->toDetail()]);
    }

    public function destroyGalleryImage(Product $product, ProductImage $image)
    {
        abort_unless($image->product_id === $product->id, 404);

        if (str_starts_with($image->path, 'storage/')) {
            Storage::disk('public')->delete(substr($image->path, strlen('storage/')));
        }
        $image->delete();

        return response()->json(['data' => $product->fresh()->load(['category', 'images'])->toDetail()]);
    }
}
