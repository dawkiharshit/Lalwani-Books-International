<?php

namespace App\Jobs;

use App\Models\Setting;
use App\Support\MailConfig;
use App\Support\MailLater;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Facade;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Testing\Fakes\MailFake;

/**
 * One shop email, sent by the background mail sender (`php artisan
 * queue:work`) where one is running — on the owner's computer, whose
 * one-request-at-a-time server would otherwise be busy for the seconds Gmail
 * takes. See App\Support\MailLater.
 */
class DeliverEmail implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /** Sent once: a failure is listed on admin → Email (SMTP), not retried into duplicates. */
    public int $tries = 1;

    public int $timeout = 60;

    public function __construct(
        public string $to,
        public string $what,
        public array $context = [],
        public ?Mailable $mail = null,
        public ?string $subject = null,
        public ?string $text = null,
    ) {}

    public function handle(): void
    {
        $this->useCurrentMailSettings();

        MailLater::deliver($this->to, $this->what, $this->context, $this->mail, $this->subject, $this->text);
    }

    /**
     * The sender runs for hours: read the shop's mail settings afresh for
     * every email, so a change (or a Disconnect) in the admin applies.
     */
    private function useCurrentMailSettings(): void
    {
        // A test's stand-in mailer stays put.
        if (Mail::getFacadeRoot() instanceof MailFake) {
            return;
        }

        Setting::flush();
        if (! app()->configurationIsCached()) {
            config(['mail' => require config_path('mail.php')]);
        }
        MailConfig::apply();
        app()->forgetInstance('mailer');
        app()->forgetInstance('mail.manager');
        Facade::clearResolvedInstance('mail.manager');
    }
}
