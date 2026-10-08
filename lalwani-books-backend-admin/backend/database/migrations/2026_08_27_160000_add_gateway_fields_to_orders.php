<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Razorpay payment references and Shiprocket shipment references per order. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('razorpay_order_id', 64)->nullable()->after('payment_status');
            $table->string('razorpay_payment_id', 64)->nullable()->after('razorpay_order_id');
            $table->string('razorpay_signature', 128)->nullable()->after('razorpay_payment_id');
            $table->timestamp('paid_at')->nullable()->after('razorpay_signature');

            $table->string('shiprocket_order_id', 64)->nullable()->after('paid_at');
            $table->string('shiprocket_shipment_id', 64)->nullable()->after('shiprocket_order_id');
            $table->string('awb_code', 64)->nullable()->after('shiprocket_shipment_id');
            $table->string('courier_name', 120)->nullable()->after('awb_code');
            $table->string('tracking_url', 500)->nullable()->after('courier_name');
            $table->timestamp('shipped_at')->nullable()->after('tracking_url');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn([
                'razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature', 'paid_at',
                'shiprocket_order_id', 'shiprocket_shipment_id', 'awb_code',
                'courier_name', 'tracking_url', 'shipped_at',
            ]);
        });
    }
};
