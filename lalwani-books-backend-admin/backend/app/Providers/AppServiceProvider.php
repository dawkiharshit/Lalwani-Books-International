<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // SMTP details entered in the admin panel override .env, so the shop
        // owner can point mail at their own mailbox without a deploy.
        \App\Support\MailConfig::apply();

        // A background mail sender (`php artisan queue:work`) says it is
        // running while it waits, so emails are handed to it (MailLater).
        \Illuminate\Support\Facades\Event::listen(
            \Illuminate\Queue\Events\Looping::class,
            fn () => \App\Support\MailLater::heartbeat()
        );

        // The reset link has to land on the Next.js app, not on Laravel —
        // this API has no HTML pages of its own.
        \Illuminate\Auth\Notifications\ResetPassword::createUrlUsing(
            fn ($user, string $token) => (config('app.frontend_url') ?: rtrim((string) config('app.url'), '/'))
                .'/reset-password?token='.$token
                .'&email='.urlencode($user->getEmailForPasswordReset())
        );
    }
}
