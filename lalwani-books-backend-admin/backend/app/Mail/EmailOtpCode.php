<?php

namespace App\Mail;

use App\Models\Setting;
use App\Models\User;
use App\Support\EmailOtp;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/** The six-digit code that confirms a new customer's email address. */
class EmailOtpCode extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public User $user, public string $code) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->code.' is your '.Setting::get('site_name', 'Lalwani Books International').' verification code',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.email-otp',
            with: [
                'code' => $this->code,
                'name' => explode(' ', trim($this->user->name))[0] ?: 'there',
                'store' => Setting::get('site_name', 'Lalwani Books International'),
                'minutes' => EmailOtp::TTL_MINUTES,
                'supportEmail' => Setting::get('support_email', ''),
            ],
        );
    }
}
