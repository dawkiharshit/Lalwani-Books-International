<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ContactMessage;
use App\Models\NewsletterSubscriber;
use Illuminate\Http\Request;

/** Newsletter subscribers + contact messages — admin visibility (arpita port). */
class AdminInboxController extends Controller
{
    public function subscribers()
    {
        $page = NewsletterSubscriber::latest()->paginate(30);

        return response()->json([
            'data' => $page->map(fn ($s) => [
                'id' => $s->id,
                'email' => $s->email,
                'created_at' => $s->created_at?->toIso8601String(),
            ])->values(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    public function destroySubscriber(NewsletterSubscriber $subscriber)
    {
        $subscriber->delete();

        return response()->json(['message' => 'Subscriber removed.']);
    }

    public function messages(Request $request)
    {
        $page = ContactMessage::query()
            ->when($request->filter === 'unread', fn ($q) => $q->where('is_read', false))
            ->latest()
            ->paginate(20);

        return response()->json([
            'data' => $page->map(fn ($m) => [
                'id' => $m->id,
                'name' => $m->name,
                'email' => $m->email,
                'subject' => $m->subject,
                'message' => $m->message,
                'is_read' => $m->is_read,
                'created_at' => $m->created_at?->toIso8601String(),
            ])->values(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'total' => $page->total(),
                'unread' => ContactMessage::where('is_read', false)->count(),
            ],
        ]);
    }

    public function updateMessage(Request $request, ContactMessage $message)
    {
        $data = $request->validate(['is_read' => ['required', 'boolean']]);
        $message->update($data);

        return response()->json(['data' => ['id' => $message->id, 'is_read' => $message->is_read]]);
    }

    public function destroyMessage(ContactMessage $message)
    {
        $message->delete();

        return response()->json(['message' => 'Message deleted.']);
    }
}
