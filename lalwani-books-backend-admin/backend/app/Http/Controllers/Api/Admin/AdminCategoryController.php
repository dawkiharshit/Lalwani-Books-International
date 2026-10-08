<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AdminCategoryController extends Controller
{
    public function index()
    {
        return response()->json([
            'data' => Category::withCount('products')
                ->orderBy('sort_order')
                ->get()
                ->map(fn (Category $c) => $this->payload($c))
                ->values(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $data['slug'] = Str::slug($data['name']);
        $data['sort_order'] = (int) ($data['sort_order'] ?? Category::max('sort_order') + 1);

        if ($request->hasFile('image')) {
            $data['image'] = 'storage/'.$request->file('image')->store('categories', 'public');
        }
        unset($data['image_file']);

        $category = Category::create($data);

        return response()->json(['data' => $this->payload($category->loadCount('products'))], 201);
    }

    public function update(Request $request, Category $category)
    {
        $data = $this->validated($request, $category->id);

        if ($request->hasFile('image')) {
            $this->deleteImage($category);
            $data['image'] = 'storage/'.$request->file('image')->store('categories', 'public');
        }

        // Only touch keys the request actually sent, so a partial update
        // (image only, or name only) never wipes the rest.
        $payload = array_intersect_key($data, array_flip($request->keys()));
        if (isset($data['image'])) {
            $payload['image'] = $data['image'];
        }
        if (isset($payload['name'])) {
            $payload['slug'] = Str::slug($payload['name']);
        }

        $category->update($payload);

        return response()->json(['data' => $this->payload($category->fresh()->loadCount('products'))]);
    }

    /** Clear the uploaded artwork — the card falls back to a product photo. */
    public function destroyImage(Category $category)
    {
        $this->deleteImage($category);
        $category->update(['image' => null]);

        return response()->json(['data' => $this->payload($category->fresh()->loadCount('products'))]);
    }

    public function destroy(Category $category)
    {
        if ($category->products()->exists()) {
            return response()->json(['message' => 'This category still has products — move them first.'], 422);
        }

        $this->deleteImage($category);
        $category->delete();

        return response()->json(['message' => 'Category deleted.']);
    }

    private function payload(Category $c): array
    {
        return [
            'id' => $c->id,
            'name' => $c->name,
            'slug' => $c->slug,
            'tagline' => $c->tagline,
            'description' => $c->description,
            'sort_order' => $c->sort_order,
            'products_count' => $c->products_count ?? 0,
            'image' => Product::imageUrl($c->image),
            'has_own_image' => (bool) $c->image,
        ];
    }

    private function deleteImage(Category $c): void
    {
        if ($c->image && str_starts_with($c->image, 'storage/')) {
            Storage::disk('public')->delete(substr($c->image, strlen('storage/')));
        }
    }

    private function validated(Request $request, ?int $ignoreId = null): array
    {
        /*
         * `name` backs a NOT NULL column with no database default, so a create
         * that omits it has to be rejected here. Under 'sometimes' it was not:
         * validation passed, Category::create() reached the insert, and MySQL
         * answered with "Field 'name' doesn't have a default value" as a 500.
         * The admin form always sends it, so this only ever showed up to an API
         * client — but a missing field is a 422 with a named field, never a
         * server error.
         *
         * Update keeps 'sometimes': a partial payload is legitimate there, and
         * update() already intersects the result with the keys actually sent.
         */
        $creating = $ignoreId === null;
        $present = $creating ? ['required'] : ['sometimes', 'required'];

        $data = $request->validate([
            'name' => [...$present, 'string', 'max:120'],
            'tagline' => ['nullable', 'string', 'max:190'],
            'description' => ['nullable', 'string', 'max:1000'],
            'sort_order' => ['nullable', 'integer'],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
        ]);

        // `slug` is derived from the name and the column is unique. Check it
        // here so a repeated name comes back as a field error instead of a raw
        // SQL integrity violation.
        if (isset($data['name'])) {
            $slug = Str::slug($data['name']);

            if ($slug === '') {
                throw ValidationException::withMessages([
                    'name' => 'Use a name with at least one letter or number.',
                ]);
            }

            $taken = Category::where('slug', $slug)
                ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
                ->exists();

            if ($taken) {
                throw ValidationException::withMessages([
                    'name' => 'A category with this name already exists.',
                ]);
            }
        }

        return $data;
    }
}
