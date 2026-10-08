<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NewsletterSubscriber;
use Illuminate\Http\Request;

class NewsletterController extends Controller
{
    public function subscribe(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:190'],
        ]);

        NewsletterSubscriber::firstOrCreate(['email' => strtolower($data['email'])]);

        return response()->json(['message' => 'Welcome to the Lalwani Books International reading list. Watch your inbox for new arrivals and member offers.']);
    }
}
