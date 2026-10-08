<?php

/**
 * Store locale + currency. Single source of truth for how money is rendered
 * server-side (invoices, mail). The storefront reads the same values through
 * /api/v1/settings so both sides always agree.
 */
return [
    'currency' => env('SHOP_CURRENCY', '₹'),
    'currency_code' => env('SHOP_CURRENCY_CODE', 'INR'),
    'locale' => env('SHOP_LOCALE', 'en-IN'),
    'tax_label' => env('SHOP_TAX_LABEL', 'GST'),

    // Rupee amounts are conventionally shown without paise.
    'decimals' => (int) env('SHOP_DECIMALS', 0),
];
