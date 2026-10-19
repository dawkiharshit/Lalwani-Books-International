<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Testimonial;
use App\Support\Media;
use App\Support\TestimonialPhotos;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AdminTestimonialController extends Controller
{
    public function index()
    {
        return response()->json([
            'data' => Testimonial::orderBy('sort_order')->get()->map->toCard()->values(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        unset($data['photo']);
        $data['is_active'] = true;
        $data['sort_order'] = (int) ($data['sort_order'] ?? Testimonial::max('sort_order') + 1);

        $testimonial = Testimonial::create($data);
        $this->savePhoto($request, $testimonial);

        return response()->json(['data' => $testimonial->fresh()->toCard()], 201);
    }

    /**
     * POST as well as PUT: a browser can only send a picture as multipart,
     * and PHP does not read a multipart body on a PUT (see the route list).
     */
    public function update(Request $request, Testimonial $testimonial)
    {
        if ($request->has('toggle')) {
            $testimonial->update(['is_active' => ! $testimonial->is_active]);

            return response()->json(['data' => $testimonial->fresh()->toCard()]);
        }

        $data = $this->validated($request);
        unset($data['photo']);
        $testimonial->update($data);
        $this->savePhoto($request, $testimonial);

        return response()->json(['data' => $testimonial->fresh()->toCard()]);
    }

    public function destroyPhoto(Testimonial $testimonial)
    {
        $this->deletePhoto($testimonial);

        return response()->json(['data' => $testimonial->fresh()->toCard()]);
    }

    public function destroy(Testimonial $testimonial)
    {
        $this->deletePhoto($testimonial);
        $testimonial->delete();

        return response()->json(['message' => 'Testimonial deleted.']);
    }

    /** Store a newly uploaded photo, replacing whatever was there. */
    private function savePhoto(Request $request, Testimonial $testimonial): void
    {
        if ($request->boolean('photo_remove')) {
            $this->deletePhoto($testimonial);

            return;
        }
        if (! $request->hasFile('photo')) {
            return;
        }

        $this->deletePhoto($testimonial);
        TestimonialPhotos::set($testimonial->id, 'storage/'.$request->file('photo')->store('testimonials', 'public'));
    }

    private function deletePhoto(Testimonial $testimonial): void
    {
        $path = TestimonialPhotos::get($testimonial->id);
        if (Media::isOurs($path)) {
            Storage::disk('public')->delete(substr((string) $path, strlen('storage/')));
        }
        TestimonialPhotos::set($testimonial->id, null);
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
            // A real picture file, checked by its contents, not its name.
            'photo' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
        ]);
    }
}
