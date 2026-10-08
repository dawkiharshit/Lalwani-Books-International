<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Blog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/** Journal / blog posts — ported from the arpita AdminBlogController. */
class AdminBlogController extends Controller
{
    public function index(Request $request)
    {
        $page = Blog::query()
            ->when($request->search, fn ($q, $s) => $q->where('title', 'like', "%{$s}%"))
            ->latest('id')
            ->paginate(20);

        return response()->json([
            'data' => collect($page->items())->map(fn (Blog $b) => array_merge($b->toCard(), [
                'is_active' => $b->is_active,
                'content' => $b->content,
                'tags' => $b->tags,
                'meta_title' => $b->meta_title,
                'meta_description' => $b->meta_description,
            ]))->values(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $data['slug'] = Str::slug($data['title']).'-'.Str::lower(Str::random(4));
        $data['user_id'] = $request->user()->id;
        $data['author_name'] = $data['author_name'] ?? $request->user()->name;
        $data['is_active'] = $request->boolean('is_active', true);
        $data['is_featured'] = $request->boolean('is_featured');
        $data['published_at'] = $data['published_at'] ?? now();

        if ($request->hasFile('thumbnail')) {
            $data['thumbnail'] = 'storage/'.$request->file('thumbnail')->store('blogs', 'public');
        }
        unset($data['thumbnail_file']);

        $blog = Blog::create($data);

        return response()->json(['data' => $blog->toDetail()], 201);
    }

    public function update(Request $request, Blog $blog)
    {
        $data = $this->validated($request, true);

        if ($request->hasFile('thumbnail')) {
            if ($blog->thumbnail && str_starts_with($blog->thumbnail, 'storage/')) {
                Storage::disk('public')->delete(substr($blog->thumbnail, strlen('storage/')));
            }
        }

        if ($request->has('is_active')) {
            $data['is_active'] = $request->boolean('is_active');
        }
        if ($request->has('is_featured')) {
            $data['is_featured'] = $request->boolean('is_featured');
        }

        // Cleared text (excerpt, category, tags, SEO fields) is saved as empty.
        // Two exceptions: the thumbnail only changes when a new file is uploaded
        // (just below), and a post never loses its publish date.
        unset($data['thumbnail']);
        if (array_key_exists('published_at', $data) && $data['published_at'] === null) {
            unset($data['published_at']);
        }
        if ($request->hasFile('thumbnail')) {
            $data['thumbnail'] = 'storage/'.$request->file('thumbnail')->store('blogs', 'public');
        }

        $blog->update($data);

        return response()->json(['data' => $blog->fresh()->toDetail()]);
    }

    /** One post with every field — the SEO editor loads from here. */
    public function show(Blog $blog)
    {
        return response()->json(['data' => $blog->toDetail()]);
    }

    /** Save only the SEO fields (its own page, its own endpoint). */
    public function updateSeo(Request $request, Blog $blog)
    {
        $data = $request->validate([
            'meta_title' => 'nullable|string|max:190',
            'meta_description' => 'nullable|string|max:300',
            'focus_keyword' => 'nullable|string|max:120',
            'meta_keywords' => 'nullable|string|max:255',
            'canonical_url' => 'nullable|url|max:255',
            'og_title' => 'nullable|string|max:190',
            'og_description' => 'nullable|string|max:300',
            'og_image' => 'nullable|url|max:255',
            'twitter_card' => 'nullable|in:summary,summary_large_image',
        ]);

        // Checkboxes arrive outside the validated set.
        $data['noindex'] = $request->boolean('noindex');
        $data['nofollow'] = $request->boolean('nofollow');

        // Cleared fields come in as null (empty strings are converted upstream),
        // so writing $data straight through lets a blanked field truly reset.
        $blog->update($data);

        return response()->json(['data' => $blog->fresh()->toDetail()]);
    }

    public function destroy(Blog $blog)
    {
        if ($blog->thumbnail && str_starts_with($blog->thumbnail, 'storage/')) {
            Storage::disk('public')->delete(substr($blog->thumbnail, strlen('storage/')));
        }
        $blog->delete();

        return response()->json(['message' => 'Post deleted.']);
    }

    private function validated(Request $request, bool $partial = false): array
    {
        $req = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'title' => "{$req}|string|max:190",
            'content' => "{$req}|string",
            'excerpt' => 'nullable|string|max:500',
            'category' => 'nullable|string|max:60',
            'tags' => 'nullable|string|max:190',
            'author_name' => 'nullable|string|max:120',
            'published_at' => 'nullable|date',
            'meta_title' => 'nullable|string|max:190',
            'meta_description' => 'nullable|string|max:500',
            'thumbnail' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:4096',
        ]);
    }
}
