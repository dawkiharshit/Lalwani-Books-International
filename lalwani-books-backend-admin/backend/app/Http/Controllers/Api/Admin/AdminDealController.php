<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Deal;
use App\Rules\SafeLink;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Deals Of The Week — the offers that slide through the home page's deals
 * panel, each with its own wording, colour, countdown and (optionally) shelf.
 */
class AdminDealController extends Controller
{
    public function index()
    {
        return response()->json([
            'data' => Deal::with('category')->orderBy('sort_order')->orderBy('id')->get()->map->toArray()->values(),
        ]);
    }

    public function show(Deal $deal)
    {
        return response()->json(['data' => $deal->load('category')->toArray()]);
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $data['sort_order'] ??= (int) Deal::max('sort_order') + 1;

        $deal = Deal::create($data);

        return response()->json(['data' => $deal->fresh('category')->toArray()], 201);
    }

    public function update(Request $request, Deal $deal)
    {
        $data = $this->validated($request, partial: true);

        // Only what was sent changes, so the list's on/off switch can send just
        // is_active; a blank sort order keeps the current position.
        $data = array_intersect_key($data, array_flip($request->keys()));
        if (array_key_exists('sort_order', $data) && $data['sort_order'] === null) {
            unset($data['sort_order']);
        }

        $deal->update($data);

        return response()->json(['data' => $deal->fresh('category')->toArray()]);
    }

    public function destroy(Deal $deal)
    {
        $deal->delete();

        return response()->json(['message' => 'Deal deleted.']);
    }

    private function validated(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'eyebrow' => ['nullable', 'string', 'max:60'],
            'heading' => [$required, 'string', 'max:160'],
            'highlight' => ['nullable', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:300'],
            'ends_label' => ['nullable', 'string', 'max:60'],
            'ends_at' => ['nullable', 'date'],
            'button_text' => ['nullable', 'string', 'max:40', 'required_with:button_url'],
            'button_url' => ['nullable', 'string', 'max:300', 'required_with:button_text', new SafeLink],
            'category_id' => ['nullable', 'integer', Rule::exists('categories', 'id')],
            'theme' => [$required, Rule::in(Deal::THEMES)],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
        ], [], [
            'button_url' => 'button link',
            'button_text' => 'button text',
            'category_id' => 'shelf',
        ]);
    }
}
