<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ContactMessage;
use Illuminate\Http\Request;

/**
 * "Books for Institutions → Request a quote": schools, universities,
 * libraries and companies asking for books in bulk.
 *
 * Each enquiry lands in admin → Messages & Subscribers like a contact
 * message, with a subject that names the organisation, so the shop sees it
 * where it already reads its mail. Throttled per visitor, and a hidden
 * "website" field catches form-filling bots: they get the usual thank-you,
 * but nothing is stored.
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
            'name' => ['required', 'string', 'max:120'],
            'organisation' => ['required', 'string', 'max:160'],
            'type' => ['required', 'in:'.implode(',', array_keys(self::TYPES))],
            'email' => ['required', 'email', 'max:190'],
            'phone' => ['required', 'string', 'max:20', 'regex:/^[0-9+()\-\s]+$/'],
            'city' => ['nullable', 'string', 'max:80'],
            'quantity' => ['nullable', 'in:'.implode(',', array_keys(self::QUANTITIES))],
            'requirements' => ['nullable', 'string', 'max:3000'],
        ], [
            'type.required' => 'Choose what kind of organisation you are.',
            'phone.regex' => 'Enter a phone number we can call.',
        ]);

        // 10 digits (mobile, or a landline with its STD code), optionally with 0 or +91 in front.
        $digits = preg_replace('/\D/', '', $data['phone']);
        if (strlen($digits) < 10 || strlen($digits) > 13) {
            return response()->json([
                'message' => 'Enter a phone number we can call.',
                'errors' => ['phone' => ['Enter a phone number we can call: 10 digits, with the STD code for a landline.']],
            ], 422);
        }

        $type = self::TYPES[$data['type']];
        $lines = array_filter([
            'Quote request — Books for Institutions',
            '',
            'Organisation: '.$data['organisation'].' ('.$type.')',
            'Contact: '.$data['name'],
            'Phone: '.$data['phone'],
            'Email: '.$data['email'],
            ! empty($data['city']) ? 'City: '.$data['city'] : null,
            ! empty($data['quantity']) ? 'Approximate quantity: '.self::QUANTITIES[$data['quantity']] : null,
            ! empty($data['requirements']) ? "\nWhat they need:\n".$data['requirements'] : null,
        ], fn ($line) => $line !== null);

        ContactMessage::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'subject' => mb_strimwidth('Quote request: '.$data['organisation'].' ('.$type.')', 0, 190, '…'),
            'message' => implode("\n", $lines),
        ]);

        return response()->json(['message' => self::THANKS], 201);
    }
}
