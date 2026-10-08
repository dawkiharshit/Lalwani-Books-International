<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Author;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/** Author management — the Categories & Authors screen, authors half. */
class AdminAuthorController extends Controller
{
    public function index()
    {
        return response()->json([
            'data' => Author::withCount('products')
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get()
                ->map->toArray()
                ->values(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $data['slug'] = Str::slug($data['name']);
        $data['sort_order'] = (int) ($data['sort_order'] ?? Author::max('sort_order') + 1);

        if ($request->hasFile('photo')) {
            $data['photo'] = 'storage/'.$request->file('photo')->store('authors', 'public');
        }

        $author = Author::create($data);

        return response()->json(['data' => $author->loadCount('products')->toArray()], 201);
    }

    public function update(Request $request, Author $author)
    {
        $data = $this->validated($request, $author->id);

        if ($request->hasFile('photo')) {
            $this->deletePhoto($author);
            $data['photo'] = 'storage/'.$request->file('photo')->store('authors', 'public');
        }

        // Only touch keys the request actually sent, so a partial update
        // (photo only, or name only) never wipes the rest.
        $payload = array_intersect_key($data, array_flip($request->keys()));
        if (isset($data['photo'])) {
            $payload['photo'] = $data['photo'];
        }
        if (isset($payload['name'])) {
            $payload['slug'] = Str::slug($payload['name']);
        }

        $author->update($payload);

        // Every book card prints the author's name from its own copy.
        if (isset($payload['name'])) {
            $author->products()->update(['author' => $author->name]);
        }

        return response()->json(['data' => $author->fresh()->loadCount('products')->toArray()]);
    }

    /** Clear the photo — the storefront falls back to initials. */
    public function destroyPhoto(Author $author)
    {
        $this->deletePhoto($author);
        $author->update(['photo' => null]);

        return response()->json(['data' => $author->fresh()->loadCount('products')->toArray()]);
    }

    public function destroy(Author $author)
    {
        if ($author->products()->exists()) {
            return response()->json(['message' => 'This author still has books — change their author first.'], 422);
        }

        $this->deletePhoto($author);
        $author->delete();

        return response()->json(['message' => 'Author deleted.']);
    }

    private function deletePhoto(Author $author): void
    {
        if ($author->photo && str_starts_with($author->photo, 'storage/')) {
            Storage::disk('public')->delete(substr($author->photo, strlen('storage/')));
        }
    }

    private function validated(Request $request, ?int $ignoreId = null): array
    {
        $creating = $ignoreId === null;
        $present = $creating ? ['required'] : ['sometimes', 'required'];

        $data = $request->validate([
            'name' => [...$present, 'string', 'max:120'],
            'bio' => ['nullable', 'string', 'max:2000'],
            'sort_order' => ['nullable', 'integer'],
            'photo' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
        ]);

        // The slug is derived from the name and must be unique: a repeated
        // name comes back as a field error, not a raw database violation.
        if (isset($data['name'])) {
            $slug = Str::slug($data['name']);
            if ($slug === '') {
                throw ValidationException::withMessages(['name' => 'Use a name with at least one letter or number.']);
            }
            $taken = Author::where('slug', $slug)
                ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
                ->exists();
            if ($taken) {
                throw ValidationException::withMessages(['name' => 'An author with this name already exists.']);
            }
        }

        return $data;
    }
}
