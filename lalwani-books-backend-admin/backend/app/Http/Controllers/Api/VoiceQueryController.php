<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Rules\IndianMobile;
use App\Support\VoiceQueries;
use Illuminate\Http\Request;

/**
 * A question a customer recorded with the website's mic button. A signed-in
 * customer is known by their account (a number is optional); anyone else
 * leaves a mobile number to be called back on. Kept privately for admin →
 * Voice Queries (see VoiceQueries).
 */
class VoiceQueryController extends Controller
{
    public function store(Request $request)
    {
        // Signed in or not: the bearer token is read when there is one.
        $user = $request->user('sanctum');
        $callBack = 'Enter your 10-digit mobile number so we can call you back.';

        $data = $request->validate([
            'audio' => ['required', 'file', 'max:'.VoiceQueries::MAX_KB],
            'seconds' => ['required', 'integer', 'min:1', 'max:'.(VoiceQueries::MAX_SECONDS + 5)],
            'phone' => [$user ? 'nullable' : 'required', 'string', 'max:20', new IndianMobile($callBack)],
            // The page it was recorded on: a path of this site, nothing else.
            'page' => ['nullable', 'string', 'max:200', 'regex:#^/(?!/)[^\s<>"\'\\\\]*$#'],
        ], [
            'audio.required' => 'The recording did not arrive — please record it again.',
            'audio.max' => 'That recording is too long. Keep it under two minutes.',
            'phone.required' => $callBack,
        ]);

        $kind = VoiceQueries::sniff($request->file('audio')->getRealPath());
        if (! $kind || $request->file('audio')->getSize() < 1024) {
            return response()->json([
                'message' => 'That recording could not be played back. Please record it again.',
                'errors' => ['audio' => ['That recording could not be played back. Please record it again.']],
            ], 422);
        }

        if ($full = VoiceQueries::full()) {
            return response()->json(['message' => $full], 503);
        }

        $phone = IndianMobile::digits($data['phone'] ?? null) ?? IndianMobile::digits($user?->phone);
        VoiceQueries::store($request->file('audio'), $kind, [
            'phone' => $phone,
            'seconds' => min((int) $data['seconds'], VoiceQueries::MAX_SECONDS),
            'page' => $data['page'] ?? null,
        ], $user);

        return response()->json([
            'message' => $phone
                ? 'Thank you! We got your question and will call you back on +91 '.substr($phone, 0, 5).' '.substr($phone, 5).' soon.'
                : 'Thank you! We got your question and will get back to you soon.',
        ], 201);
    }
}
