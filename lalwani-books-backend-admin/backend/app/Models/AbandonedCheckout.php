<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AbandonedCheckout extends Model
{
    protected $fillable = [
        'cart_token', 'user_id', 'email', 'ship_name', 'ship_phone',
        'ship_address1', 'ship_city', 'ship_state', 'ship_zip',
        'cart_snapshot', 'subtotal',
    ];

    protected $casts = [
        'cart_snapshot' => 'array',
        'subtotal' => 'float',
    ];
}
