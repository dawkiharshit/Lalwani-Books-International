<?php

namespace App\Mail;

use App\Models\Setting;
use App\Models\User;
use App\Support\PasswordOtp;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/** The six-digit code that lets someone set a new password. */
class PasswordResetCode extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public User $user, public string $code) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->code.' is your '.Setting::get('site_name', 'Lalwani Books International').' password reset code',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.password-otp',
            with: [
                'code' => $this->code,
                'name' => explode(' ', trim($this->user->name))[0] ?: 'there',
                'store' => Setting::get('site_name', 'Lalwani Books International'),
                'minutes' => PasswordOtp::TTL_MINUTES,
                'supportEmail' => Setting::get('support_email', ''),
            ],
        );
    }
}
