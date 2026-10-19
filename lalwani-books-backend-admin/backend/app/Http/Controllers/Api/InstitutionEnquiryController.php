<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ContactMessage;
use App\Support\QuoteFiles;
use Illuminate\Http\Request;

/**
 * "Books for Institutions → Request a quote": schools, universities,
 * libraries and companies asking for books in bulk.
 *
 * Each enquiry lands in admin → Messages & Subscribers like a contact
 * message, with a subject that names the organisation, so the shop sees it
 * where it already reads its mail. A reading list can come with it as a CSV
 * or a PDF, kept privately beside the message (see QuoteFiles). Throttled per
 * visitor, and a hidden "website" field catches form-filling bots: they get
 * the usual thank-you, but nothing is stored.
 */
class InstitutionEnquiryController extends Controller
{
    public const TYPES = [
        'school' => 'School',
        'university' => 'University / College',
        'library' => 'Library',
        'corporate' => 'Corporate',
        'other' => 'Other',
    ];

    public const QUANTITIES = [
        'under-50' => 'Under 50 books',
        '50-200' => '50 – 200 books',
        '200-1000' => '200 – 1,000 books',
        '1000-plus' => 'More than 1,000 books',
    ];

    private const THANKS = 'Thank you. We have your request and will get back to you with a quote within 24 hours.';

    public function store(Request $request)
    {
        // A person never sees or fills this field; a bot fills everything.
        if (trim((string) $request->input('website', '')) !== '') {
            return response()->json(['message' => self::THANKS], 201);
        }

        $data = $request->validate([
            // Nothing here has to be filled in: whoever is asking says as much
            // as they want to. What they do give still has to make sense.
            'name' => ['nullable', 'string', 'max:120'],
            'organisation' => ['nullable', 'string', 'max:160'],
            'type' => ['nullable', 'in:'.implode(',', array_keys(self::TYPES))],
            'email' => ['nullable', 'email', 'max:190'],
            'phone' => ['nullable', 'string', 'max:20', 'regex:/^[0-9+()\-\s]+$/'],
            'city' => ['nullable', 'string', 'max:80'],
            'quantity' => ['nullable', 'in:'.implode(',', array_keys(self::QUANTITIES))],
            'requirements' => ['nullable', 'string', 'max:3000'],
            'files' => ['nullable', 'array', 'max:'.QuoteFiles::MAX_FILES],
            'files.*' => ['file', 'max:'.QuoteFiles::MAX_KB],
        ], [
            'phone.regex' => 'Enter a phone number we can call.',
            'files.max' => 'Attach up to '.QuoteFiles::MAX_FILES.' files.',
            'files.*.max' => 'Each file must be under '.(int) (QuoteFiles::MAX_KB / 1024).' MB.',
        ]);

        $name = trim($data['name'] ?? '');
        $organisation = trim($data['organisation'] ?? '');
        $email = trim($data['email'] ?? '');
        $phone = trim($data['phone'] ?? '');

        // The one thing a quote cannot do without: somewhere to send it.
        if ($email === '' && $phone === '') {
            return response()->json([
                'message' => 'Leave us an email address or a phone number, so we can send you the quote.',
            ], 422);
        }

        // 10 digits (mobile, or a landline with its STD code), optionally with 0 or +91 in front.
        $digits = preg_replace('/\D/', '', $phone);
        if ($phone !== '' && (strlen($digits) < 10 || strlen($digits) > 13)) {
            return response()->json([
                'message' => 'Enter a phone number we can call.',
                'errors' => ['phone' => ['Enter a phone number we can call: 10 digits, with the STD code for a landline.']],
            ], 422);
        }

        // What each attachment really is, read from its own first bytes. A
        // name ending in .csv proves nothing.
        $uploads = array_values($request->file('files') ?? []);
        $kinds = [];
        foreach ($uploads as $upload) {
            $kind = QuoteFiles::sniff($upload->getRealPath());
            if (! $kind) {
                return response()->json([
                    'message' => 'Attach your list as a CSV or a PDF file.',
                    'errors' => ['files' => ['Attach your list as a CSV or a PDF file — that one is neither.']],
                ], 422);
            }
            $kinds[] = $kind;
        }
        // The request is still taken when there is no room for the file: it is
        // the enquiry that matters, and losing it would be the worse failure.
        $noRoom = $uploads ? QuoteFiles::full() : null;

        // Only what was actually given is written down, so the message never
        // reads "Email:" with nothing after it.
        $type = ! empty($data['type']) ? self::TYPES[$data['type']] : null;
        $who = $organisation !== '' ? $organisation.($type ? ' ('.$type.')' : '') : $type;
        $lines = array_filter([
            'Quote request — Books for Institutions',
            '',
            $who ? 'Organisation: '.$who : null,
            $name !== '' ? 'Contact: '.$name : null,
            $phone !== '' ? 'Phone: '.$phone : null,
            $email !== '' ? 'Email: '.$email : null,
            ! empty($data['city']) ? 'City: '.$data['city'] : null,
            ! empty($data['quantity']) ? 'Approximate quantity: '.self::QUANTITIES[$data['quantity']] : null,
            ! empty($data['requirements']) ? "\nWhat they need:\n".$data['requirements'] : null,
        ], fn ($line) => $line !== null);

        // The inbox lists messages by name and subject, so both fall back to
        // whatever the sender did give.
        $called = $name !== '' ? $name : ($organisation !== '' ? $organisation : 'Not given');
        $about = $organisation !== '' ? $organisation : ($name !== '' ? $name : 'Books for Institutions');
        $message = ContactMessage::create([
            'name' => $called,
            'email' => $email,
            'subject' => mb_strimwidth('Quote request: '.$about.($type ? ' ('.$type.')' : ''), 0, 190, '…'),
            'message' => implode("\n", $lines),
        ]);

        // The files go in under the message's own id, then the message says so
        // in words — admin → Messages reads on its own, with or without them.
        if ($uploads && ! $noRoom) {
            $kept = QuoteFiles::store($message->id, $uploads, $kinds);
            $named = implode(', ', array_map(fn ($f) => $f['name'].' ('.self::size((int) $f['bytes']).')', $kept));
            $message->update(['message' => $message->message."\n\nAttached: ".$named]);
        } elseif ($uploads) {
            $message->update(['message' => $message->message."\n\nThey attached a file, but there was no room to keep it — ask them to email it."]);
        }

        return response()->json(['message' => $noRoom ? self::THANKS.' '.$noRoom : self::THANKS], 201);
    }

    /** A file's size as the shop reads it. */
    private static function size(int $bytes): string
    {
        return $bytes >= 1024 * 1024
            ? round($bytes / 1024 / 1024, 1).' MB'
            : max(1, (int) round($bytes / 1024)).' KB';
    }
}
