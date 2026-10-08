<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Testimonial;
use Illuminate\Http\Request;

class AdminTestimonialController extends Controller
{
    public function index()
    {
        return response()->json([
            'data' => Testimonial::orderBy('sort_order')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $data['is_active'] = true;
        $data['sort_order'] = (int) ($data['sort_order'] ?? Testimonial::max('sort_order') + 1);

        return response()->json(['data' => Testimonial::create($data)], 201);
    }

    public function update(Request $request, Testimonial $testimonial)
    {
        if ($request->has('toggle')) {
            $testimonial->update(['is_active' => ! $testimonial->is_active]);
        } else {
            $testimonial->update($this->validated($request));
        }

        return response()->json(['data' => $testimonial->fresh()]);
    }

    public function destroy(Testimonial $testimonial)
    {
        $testimonial->delete();

        return response()->json(['message' => 'Testimonial deleted.']);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'designation' => ['nullable', 'string', 'max:120'],
            'location' => ['nullable', 'string', 'max:120'],
            'content' => ['required', 'string', 'max:1000'],
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'sort_order' => ['nullable', 'integer'],
        ]);
    }
}
