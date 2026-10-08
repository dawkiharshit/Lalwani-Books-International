<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Admin and demo accounts.
 *
 * The admin credentials come from the environment, never from this file. A
 * password committed to a seeder is a published password — this repo is the
 * shared Template02 base, so anyone who can read it could sign in to every
 * store built from it. Set ADMIN_EMAIL / ADMIN_PASSWORD in .env (gitignored).
 *
 * With no ADMIN_PASSWORD set the seeder generates a random one and prints it
 * once. That is deliberate: an unattended `migrate --seed` should not quietly
 * create a reachable admin account with a password anyone could guess.
 */
class UserSeeder extends Seeder
{
    public function run(): void
    {
        $email = env('ADMIN_EMAIL', 'admin@lalwanibooks.com');
        $password = env('ADMIN_PASSWORD');
        $generated = false;

        if (blank($password)) {
            $password = Str::password(20);
            $generated = true;
        }

        // 'password' is cast to 'hashed' on the model, so plaintext is correct
        // here — Laravel hashes it on assignment. Never pass Hash::make().
        User::updateOrCreate(
            ['email' => $email],
            [
                'name' => env('ADMIN_NAME', 'Lalwani Books Admin'),
                'password' => $password,
                'phone' => env('ADMIN_PHONE', '+91 98765 43210'),
            ]
        )->forceFill(['is_admin' => true])->save();

        if ($generated) {
            $this->command?->warn('No ADMIN_PASSWORD in .env — generated one for '.$email.':');
            $this->command?->line('  '.$password);
            $this->command?->warn('Save it now; it is not stored anywhere and will not be shown again.');
        } else {
            $this->command?->info('Admin account seeded: '.$email);
        }

        // Demo customer for exercising the storefront. Harmless to publish:
        // it is a non-admin account on a throwaway example.com address.
        //
        // Seeded already-verified on purpose. Confirming an address needs a
        // six-digit code by email, so on any install without working SMTP the
        // demo account could never clear the "email is not confirmed" banner —
        // it would nag through every test run with no way to dismiss it.
        // forceFill for the timestamp, not the array above: email_verified_at is
        // deliberately absent from $fillable, so mass-assigning it silently does
        // nothing. Keeping it unfillable is the point — no request payload
        // should ever be able to mark itself verified.
        User::updateOrCreate(
            ['email' => 'sophia@example.com'],
            [
                'name' => 'Sophia Martin',
                'password' => 'Password1!',
                'phone' => '+91 98765 43211',
            ]
        )->forceFill(['email_verified_at' => now()])->save();

        $this->command?->info('Demo customer seeded: sophia@example.com / Password1!');
    }
}
