<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Support\SearchLog;
use Illuminate\Http\Request;

/** Admin → Search insights: what shoppers search for, and what they could not find. */
class AdminSearchInsightsController extends Controller
{
    public function index(Request $request)
    {
        $days = (int) $request->query('days', 30);

        return response()->json([
            'data' => SearchLog::report(in_array($days, SearchLog::PERIODS, true) ? $days : 30),
        ]);
    }
}
