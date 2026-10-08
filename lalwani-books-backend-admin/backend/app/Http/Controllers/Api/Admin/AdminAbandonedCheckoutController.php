<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AbandonedCheckout;

class AdminAbandonedCheckoutController extends Controller
{
    /** Most recently active first — the freshest leads to follow up. */
    public function index()
    {
        return response()->json([
            'data' => AbandonedCheckout::latest('updated_at')->limit(200)->get(),
        ]);
    }

    public function destroy(AbandonedCheckout $abandonedCheckout)
    {
        $abandonedCheckout->delete();

        return response()->json(['message' => 'Removed.']);
    }
}
