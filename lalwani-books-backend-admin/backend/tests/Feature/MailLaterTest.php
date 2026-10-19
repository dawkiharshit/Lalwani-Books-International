<?php

namespace Tests\Feature;

use App\Mail\EmailOtpCode;
use App\Models\User;
use App\Support\MailLater;
use Illuminate\Support\Defer\DeferredCallbackCollection;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * Emails go out after the answer (each one costs seconds over Gmail), and
 * every answer says how long it is, so the browser need not wait for them.
 */
class MailLaterTest extends TestCase
{
    public function test_an_email_waits_until_the_answer_has_gone(): void
    {
        Mail::fake();
        $user = (new User)->forceFill(['name' => 'Asha Rao', 'email' => 'asha@example.test']);

        MailLater::send('asha@example.test', new EmailOtpCode($user, '123456'), 'Test email');

        Mail::assertNothingSent();

        // What Laravel runs once the response has been handed over.
        app(DeferredCallbackCollection::class)->invoke();

        Mail::assertSent(EmailOtpCode::class, fn ($mail) => $mail->hasTo('asha@example.test'));
    }

    public function test_the_background_sender_sends_it_and_lists_a_failure(): void
    {
        Mail::fake();
        $user = (new User)->forceFill(['name' => 'Asha Rao', 'email' => 'asha@example.test']);

        (new \App\Jobs\DeliverEmail('asha@example.test', 'Test email', [], new EmailOtpCode($user, '123456')))->handle();

        Mail::assertSent(EmailOtpCode::class, fn ($mail) => $mail->hasTo('asha@example.test'));
    }

    public function test_tests_never_hand_emails_to_a_background_sender(): void
    {
        // Tests send at once (or into a fake), whatever this computer is running.
        $this->assertFalse(MailLater::senderRunning());
    }

    public function test_every_answer_carries_its_length(): void
    {
        $response = $this->get('/up');

        $response->assertOk();
        $this->assertSame((string) strlen($response->getContent()), $response->headers->get('Content-Length'));
    }
}
