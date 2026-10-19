<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Support\VoiceQueries;
use Illuminate\Http\Request;

/** Admin → Voice Queries: listen to what customers recorded, call them back, mark it answered. */
class AdminVoiceQueryController extends Controller
{
    public function index(Request $request)
    {
        $status = in_array($request->query('status'), ['new', 'answered', 'all'], true) ? $request->query('status') : 'new';
        $page = max(1, (int) $request->query('page', 1));
        $list = VoiceQueries::list($status, $page);

        return response()->json([
            'data' => $list['data'],
            'meta' => [
                'page' => $page,
                'last_page' => max(1, (int) ceil($list['total'] / 20)),
                'total' => $list['total'],
                'new' => VoiceQueries::newCount(),
                'keep_days' => VoiceQueries::KEEP_DAYS,
            ],
        ]);
    }

    public function count()
    {
        return response()->json(['data' => ['new' => VoiceQueries::newCount()]]);
    }

    /** The recording itself — only ever as one of the three audio types it was checked to be. */
    public function audio(string $id)
    {
        $entry = VoiceQueries::get($id);
        $audio = $entry ? VoiceQueries::audio($entry) : null;
        abort_unless($audio, 404);

        return response()->file($audio['path'], [
            'Content-Type' => $audio['type'],
            'Content-Disposition' => 'inline; filename="voice-query-'.$id.'.'.$audio['ext'].'"',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    public function update(Request $request, string $id)
    {
        $entry = VoiceQueries::get($id);
        abort_unless($entry, 404);
        $data = $request->validate(['answered' => ['required', 'boolean']]);

        return response()->json(['data' => VoiceQueries::mark($entry, (bool) $data['answered'])]);
    }

    public function destroy(string $id)
    {
        abort_unless(VoiceQueries::get($id), 404);
        VoiceQueries::delete($id);

        return response()->json(['message' => 'Voice query deleted.']);
    }
}
