<?php

use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Refund destinations — a customer's UPI ID and bank account details — were
 * stored in plain text. They are now encrypted at rest (ReturnRequest casts
 * them), so a copy of the database alone does not expose them. Existing rows
 * are encrypted here; the columns become text because the ciphertext is far
 * longer than the plain values.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_returns', function (Blueprint $table) {
            $table->text('refund_upi')->nullable()->change();
            $table->text('refund_bank')->nullable()->change();
        });

        foreach ($this->rows() as $row) {
            $update = [];
            if ($row->refund_upi !== null && ! $this->isEncrypted($row->refund_upi)) {
                $update['refund_upi'] = Crypt::encryptString($row->refund_upi);
            }
            // The stored JSON text is exactly what the "encrypted:array" cast
            // expects to find inside the ciphertext.
            if ($row->refund_bank !== null && ! $this->isEncrypted($row->refund_bank)) {
                $update['refund_bank'] = Crypt::encryptString($row->refund_bank);
            }
            if ($update) {
                DB::table('order_returns')->where('id', $row->id)->update($update);
            }
        }
    }

    public function down(): void
    {
        foreach ($this->rows() as $row) {
            $update = [];
            if ($row->refund_upi !== null && $this->isEncrypted($row->refund_upi)) {
                $update['refund_upi'] = Crypt::decryptString($row->refund_upi);
            }
            if ($row->refund_bank !== null && $this->isEncrypted($row->refund_bank)) {
                $update['refund_bank'] = Crypt::decryptString($row->refund_bank);
            }
            if ($update) {
                DB::table('order_returns')->where('id', $row->id)->update($update);
            }
        }
    }

    private function rows()
    {
        return DB::table('order_returns')
            ->where(fn ($q) => $q->whereNotNull('refund_upi')->orWhereNotNull('refund_bank'))
            ->get(['id', 'refund_upi', 'refund_bank']);
    }

    private function isEncrypted(string $value): bool
    {
        try {
            Crypt::decryptString($value);

            return true;
        } catch (DecryptException) {
            return false;
        }
    }
};
