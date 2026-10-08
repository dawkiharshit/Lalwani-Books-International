<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Only the hash is stored — a leaked database must not hand
            // anyone a working code.
            $table->string('email_otp')->nullable()->after('email_verified_at');
            $table->timestamp('email_otp_expires_at')->nullable()->after('email_otp');
            $table->timestamp('email_otp_sent_at')->nullable()->after('email_otp_expires_at');
            $table->unsignedTinyInteger('email_otp_attempts')->default(0)->after('email_otp_sent_at');

            $table->string('google_id')->nullable()->unique()->after('is_admin');
            $table->string('avatar')->nullable()->after('google_id');
        });

        // Someone who signs in with Google never picks a password.
        Schema::table('users', function (Blueprint $table) {
            $table->string('password')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'email_otp',
                'email_otp_expires_at',
                'email_otp_sent_at',
                'email_otp_attempts',
                'avatar',
            ]);
            $table->dropUnique(['google_id']);
            $table->dropColumn('google_id');
        });
    }
};
