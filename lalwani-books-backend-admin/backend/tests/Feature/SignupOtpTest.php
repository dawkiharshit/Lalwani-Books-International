<?php

namespace Tests\Feature;

use App\Mail\EmailOtpCode;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * Creating an account takes two steps, like "forgot password": the form, then
 * the six-digit code mailed to the address. No account exists until the code
 * is entered. Mail is faked: nothing is sent.
 *
 *   DB_CONNECTION=mysql DB_DATABASE=lalwani_books_test php artisan test --filter=SignupOtpTest
 */
class SignupOtpTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        // A mailer the shop counts as able to deliver (MailConfig::deliverable),
        // with every message caught by the fake instead of being sent.
        config(['mail.default' => 'smtp', 'mail.mailers.smtp.host' => 'smtp.example.test']);
        Mail::fake();
    }

    private function form(array $extra = []): array
    {
        return $extra + [
            'name' => 'Asha Rao',
            'email' => 'asha.'.uniqid().'@example.test',
            'phone' => '9876543210',
            'password' => 'Secret-pass-1',
            'password_confirmation' => 'Secret-pass-1',
        ];
    }

    /** The newest code mailed to an address. */
    private function mailedCode(string $email): string
    {
        return Mail::sent(EmailOtpCode::class, fn (EmailOtpCode $m) => $m->hasTo($email))->last()->code;
    }

    private function wrong(string $code): string
    {
        return str_pad((string) (((int) $code + 1) % 1000000), 6, '0', STR_PAD_LEFT);
    }

    public function test_signing_up_emails_a_code_and_creates_the_account_only_once_it_is_entered(): void
    {
        $form = $this->form();

        $this->postJson('/api/v1/auth/register', $form)
            ->assertStatus(202)
            ->assertJsonPath('otp_required', true)
            ->assertJsonPath('email', $form['email'])
            ->assertJsonMissingPath('token');
        $this->assertFalse(User::where('email', $form['email'])->exists(), 'no account before the code');

        $res = $this->postJson('/api/v1/auth/register/verify', ['email' => $form['email'], 'code' => $this->mailedCode($form['email'])])
            ->assertCreated()
            ->assertJsonPath('user.email', $form['email'])
            ->assertJsonPath('user.email_verified', true);
        $this->assertNotEmpty($res->json('token'));

        $user = User::where('email', $form['email'])->firstOrFail();
        $this->assertNotNull($user->email_verified_at);
        $this->assertSame('9876543210', $user->phone);
        // Stored once-hashed: the typed password works, so it was not hashed twice.
        $this->assertTrue(Hash::check('Secret-pass-1', $user->password));
        $this->postJson('/api/v1/auth/login', ['email' => $form['email'], 'password' => 'Secret-pass-1'])->assertOk();

        // The code is used up.
        $this->postJson('/api/v1/auth/register/verify', ['email' => $form['email'], 'code' => $this->mailedCode($form['email'])])
            ->assertStatus(422);
    }

    public function test_wrong_codes_are_refused_and_five_of_them_end_that_code(): void
    {
        $form = $this->form();
        $this->postJson('/api/v1/auth/register', $form)->assertStatus(202);
        $code = $this->mailedCode($form['email']);

        $this->postJson('/api/v1/auth/register/verify', ['email' => $form['email'], 'code' => $this->wrong($code)])
            ->assertStatus(422)
            ->assertJsonPath('errors.code.0', 'That code is not right. 4 tries left.');
        foreach (range(1, 4) as $n) {
            $last = $this->postJson('/api/v1/auth/register/verify', ['email' => $form['email'], 'code' => $this->wrong($code)]);
        }
        $last->assertJsonPath('errors.code.0', 'Too many wrong codes. Send yourself a new one.');

        // Even the right code no longer works; no account was made.
        $this->postJson('/api/v1/auth/register/verify', ['email' => $form['email'], 'code' => $code])
            ->assertStatus(422)
            ->assertJsonPath('errors.code.0', 'Ask for a new code — this one is no longer valid.');
        $this->assertFalse(User::where('email', $form['email'])->exists());
    }

    public function test_a_new_code_can_be_sent_after_a_minute_and_replaces_the_old_one(): void
    {
        $form = $this->form();
        $this->postJson('/api/v1/auth/register', $form)->assertStatus(202);
        $first = $this->mailedCode($form['email']);

        $this->postJson('/api/v1/auth/register/resend', ['email' => $form['email']])
            ->assertStatus(429)
            ->assertJsonStructure(['retry_after']);

        $this->travel(61)->seconds();
        $this->postJson('/api/v1/auth/register/resend', ['email' => $form['email']])->assertOk();
        $second = $this->mailedCode($form['email']);
        Mail::assertSent(EmailOtpCode::class, 2);

        if ($first !== $second) {
            $this->postJson('/api/v1/auth/register/verify', ['email' => $form['email'], 'code' => $first])->assertStatus(422);
        }
        $this->postJson('/api/v1/auth/register/verify', ['email' => $form['email'], 'code' => $second])->assertCreated();
    }

    public function test_sending_the_form_twice_quickly_mails_one_code_and_keeps_the_newest_details(): void
    {
        $form = $this->form();
        $this->postJson('/api/v1/auth/register', $form)->assertStatus(202);
        $this->postJson('/api/v1/auth/register', ['name' => 'Asha R. Rao'] + $form)->assertStatus(202);

        Mail::assertSent(EmailOtpCode::class, 1);
        $this->postJson('/api/v1/auth/register/verify', ['email' => $form['email'], 'code' => $this->mailedCode($form['email'])])
            ->assertCreated()
            ->assertJsonPath('user.name', 'Asha R. Rao');
    }

    public function test_an_expired_code_is_refused(): void
    {
        $form = $this->form();
        $this->postJson('/api/v1/auth/register', $form)->assertStatus(202);
        $code = $this->mailedCode($form['email']);

        $this->travel(11)->minutes();
        $this->postJson('/api/v1/auth/register/verify', ['email' => $form['email'], 'code' => $code])
            ->assertStatus(422)
            ->assertJsonPath('errors.code.0', 'That code has expired. Send yourself a new one.');
    }

    public function test_an_address_registered_meanwhile_never_gets_a_second_account(): void
    {
        $form = $this->form();
        $this->postJson('/api/v1/auth/register', $form)->assertStatus(202);
        User::factory()->create(['email' => $form['email']]); // e.g. signed up with Google meanwhile

        $this->postJson('/api/v1/auth/register/verify', ['email' => $form['email'], 'code' => $this->mailedCode($form['email'])])
            ->assertStatus(422)
            ->assertJsonPath('errors.code.0', 'This email already has an account. Sign in instead.');
        $this->assertSame(1, User::where('email', $form['email'])->count());
    }

    public function test_without_working_email_nobody_can_sign_up(): void
    {
        config(['mail.default' => 'log']);
        $form = $this->form();

        $this->postJson('/api/v1/auth/register', $form)->assertStatus(503);
        Mail::assertNothingSent();
        $this->assertFalse(User::where('email', $form['email'])->exists());
    }

    public function test_the_form_rules_still_apply(): void
    {
        $taken = User::factory()->create();
        $this->postJson('/api/v1/auth/register', $this->form(['email' => $taken->email]))
            ->assertStatus(422)->assertJsonValidationErrors('email');
        $this->postJson('/api/v1/auth/register', $this->form(['password_confirmation' => 'something-else']))
            ->assertStatus(422)->assertJsonValidationErrors('password');
        $this->postJson('/api/v1/auth/register/verify', ['email' => 'nobody@example.test', 'code' => '12ab56'])
            ->assertStatus(422)->assertJsonValidationErrors('code');
        Mail::assertNothingSent();
    }
}
