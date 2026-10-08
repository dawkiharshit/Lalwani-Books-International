<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Author;

class AuthorController extends Controller
{
    /** Every author, with how many of their books are live in the shop. */
    public function index()
    {
        return response()->json([
            'data' => Author::query()
                ->withCount(['products' => fn ($q) => $q->where('is_active', true)])
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get()
                ->map->toArray()
                ->values(),
        ]);
    }
}
