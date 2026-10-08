<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Publisher;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/** Publisher management — the admin Publishers screen. */
class AdminPublisherController extends Controller
{
    public function index()
    {
        return response()->json([
            'data' => Publisher::withCount('products')
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
        $data['sort_order'] = (int) ($data['sort_order'] ?? Publisher::max('sort_order') + 1);

        if ($request->hasFile('logo')) {
            $data['logo'] = 'storage/'.$request->file('logo')->store('publishers', 'public');
        }

        $publisher = Publisher::create($data);

        return response()->json(['data' => $publisher->loadCount('products')->toArray()], 201);
    }

    public function update(Request $request, Publisher $publisher)
    {
        $data = $this->validated($request, $publisher->id);

        if ($request->hasFile('logo')) {
            $this->deleteLogo($publisher);
            $data['logo'] = 'storage/'.$request->file('logo')->store('publishers', 'public');
        }

        // Only touch keys the request actually sent, so a partial update
        // (logo only, or name only) never wipes the rest.
        $payload = array_intersect_key($data, array_flip($request->keys()));
        if (isset($data['logo'])) {
            $payload['logo'] = $data['logo'];
        }
        if (isset($payload['name'])) {
            $payload['slug'] = Str::slug($payload['name']);
        }

        $publisher->update($payload);

        // Every book page prints the publisher's name from its own copy.
        if (isset($payload['name'])) {
            $publisher->products()->update(['publisher' => $publisher->name]);
        }

        return response()->json(['data' => $publisher->fresh()->loadCount('products')->toArray()]);
    }

    /** Clear the logo — the storefront falls back to initials. */
    public function destroyLogo(Publisher $publisher)
    {
        $this->deleteLogo($publisher);
        $publisher->update(['logo' => null]);

        return response()->json(['data' => $publisher->fresh()->loadCount('products')->toArray()]);
    }

    public function destroy(Publisher $publisher)
    {
        if ($publisher->products()->exists()) {
            return response()->json(['message' => 'This publisher still has books — change their publisher first.'], 422);
        }

        $this->deleteLogo($publisher);
        $publisher->delete();

        return response()->json(['message' => 'Publisher deleted.']);
    }

    private function deleteLogo(Publisher $publisher): void
    {
        if ($publisher->logo && str_starts_with($publisher->logo, 'storage/')) {
            Storage::disk('public')->delete(substr($publisher->logo, strlen('storage/')));
        }
    }

    private function validated(Request $request, ?int $ignoreId = null): array
    {
        $creating = $ignoreId === null;
        $present = $creating ? ['required'] : ['sometimes', 'required'];

        $data = $request->validate([
            'name' => [...$present, 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:2000'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:99999'],
            'logo' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
        ]);

        // The slug is derived from the name and must be unique: a repeated
        // name comes back as a field error, not a raw database violation.
        if (isset($data['name'])) {
            $slug = Str::slug($data['name']);
            if ($slug === '') {
                throw ValidationException::withMessages(['name' => 'Use a name with at least one letter or number.']);
            }
            $taken = Publisher::where('slug', $slug)
                ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
                ->exists();
            if ($taken) {
                throw ValidationException::withMessages(['name' => 'A publisher with this name already exists.']);
            }
        }

        return $data;
    }
}
