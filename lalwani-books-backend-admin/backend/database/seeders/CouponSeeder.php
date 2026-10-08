<?php

namespace Database\Seeders;

use App\Models\Coupon;
use Illuminate\Database\Seeder;

class CouponSeeder extends Seeder
{
    public function run(): void
    {
        $coupons = [
            ['code' => 'WELCOME10', 'type' => 'percent', 'value' => 10, 'min_order' => 0, 'max_uses' => null, 'is_active' => true],
            ['code' => 'HIVE20', 'type' => 'percent', 'value' => 20, 'min_order' => 5999, 'max_uses' => 500, 'is_active' => true],
            ['code' => 'HONEY15', 'type' => 'fixed', 'value' => 500, 'min_order' => 2499, 'max_uses' => 200, 'is_active' => true],
        ];

        foreach ($coupons as $coupon) {
            Coupon::updateOrCreate(['code' => $coupon['code']], $coupon);
        }
    }
}
