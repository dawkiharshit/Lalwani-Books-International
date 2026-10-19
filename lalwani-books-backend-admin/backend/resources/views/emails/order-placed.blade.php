@php use App\Support\Money; @endphp
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $store }} — {{ $order->order_number }}</title>
</head>
<body style="margin:0;padding:0;background:#f0f3f7;font-family:-apple-system,Segoe UI,Arial,sans-serif;color:#0f1d2e;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f3f7;padding:28px 12px;">
    <tr>
        <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;">

                <tr>
                    <td bgcolor="#042b52" style="background:#042b52;background-image:linear-gradient(135deg,#042b52,#0d4377);padding:28px 30px;text-align:center;border-bottom:3px solid #e8b04b;">
                        <p style="margin:0;font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:600;color:#e8b04b;">
                            {{ $forAdmin ? 'New order' : 'Thank you' }}
                        </p>
                        <h1 style="margin:8px 0 0;font-family:Georgia,serif;font-size:26px;font-weight:400;color:#ffffff;">
                            {{ $forAdmin ? 'An order just came in' : 'Your order is confirmed' }}
                        </h1>
                        <p style="margin:8px 0 0;font-size:13px;color:#c9d6e6;">
                            Order <strong style="color:#ffffff;">{{ $order->order_number }}</strong>
                        </p>
                    </td>
                </tr>

                <tr>
                    <td style="padding:26px 30px 6px;">
                        @unless($forAdmin)
                            <p style="margin:0 0 18px;font-size:13.5px;line-height:1.6;color:#5e6a7a;">
                                Hi {{ explode(' ', trim($order->ship_name))[0] ?: 'there' }}, we have your order and
                                it is being prepared. You will hear from us again when it ships.
                            </p>
                        @endunless

                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            @foreach($order->items as $item)
                                <tr>
                                    <td style="padding:9px 0;border-bottom:1px solid #e0e6ee;font-size:13px;color:#0f1d2e;">
                                        {{ $item->name }}
                                        <span style="color:#5e6a7a;">&times; {{ $item->quantity }}</span>
                                    </td>
                                    <td align="right" style="padding:9px 0;border-bottom:1px solid #e0e6ee;font-size:13px;color:#0f1d2e;white-space:nowrap;">
                                        {{ Money::format($item->total) }}
                                    </td>
                                </tr>
                            @endforeach
                        </table>

                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;">
                            <tr>
                                <td style="padding:3px 0;font-size:12.5px;color:#5e6a7a;">Subtotal</td>
                                <td align="right" style="padding:3px 0;font-size:12.5px;color:#5e6a7a;">{{ Money::format($order->subtotal) }}</td>
                            </tr>
                            @if($order->discount > 0)
                                <tr>
                                    <td style="padding:3px 0;font-size:12.5px;color:#5e6a7a;">Discount{{ $order->coupon_code ? ' ('.$order->coupon_code.')' : '' }}</td>
                                    <td align="right" style="padding:3px 0;font-size:12.5px;color:#0d4377;">-{{ Money::format($order->discount) }}</td>
                                </tr>
                            @endif
                            <tr>
                                <td style="padding:3px 0;font-size:12.5px;color:#5e6a7a;">Shipping</td>
                                <td align="right" style="padding:3px 0;font-size:12.5px;color:#5e6a7a;">
                                    {{ $order->shipping > 0 ? Money::format($order->shipping) : 'Free' }}
                                </td>
                            </tr>
                            <tr>
                                <td style="padding:3px 0;font-size:12.5px;color:#5e6a7a;">{{ config('shop.tax_label', 'GST') }}</td>
                                <td align="right" style="padding:3px 0;font-size:12.5px;color:#5e6a7a;">{{ Money::format($order->tax) }}</td>
                            </tr>
                            <tr>
                                <td style="padding:10px 0 0;border-top:1px solid #e0e6ee;font-size:15px;font-weight:600;">Total</td>
                                <td align="right" style="padding:10px 0 0;border-top:1px solid #e0e6ee;font-size:15px;font-weight:600;">
                                    {{ Money::format($order->total) }}
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>

                <tr>
                    <td style="padding:20px 30px 4px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eaf0f7;border-radius:12px;">
                            <tr>
                                <td style="padding:16px 18px;font-size:12.5px;line-height:1.65;color:#5e6a7a;">
                                    <strong style="color:#0f1d2e;">Delivering to</strong><br>
                                    {{ $order->ship_name }}<br>
                                    {{ $order->ship_address1 }}@if($order->ship_address2), {{ $order->ship_address2 }}@endif<br>
                                    {{ $order->ship_city }}, {{ $order->ship_state }} {{ $order->ship_zip }}<br>
                                    {{ $order->ship_phone }}
                                    <br><br>
                                    <strong style="color:#0f1d2e;">Payment</strong>
                                    {{ $order->payment_method === 'razorpay' ? 'Online (Razorpay)' : 'Cash on Delivery' }}
                                    — {{ $order->payment_status === 'paid' ? 'Paid' : 'Payment pending' }}
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>

                @unless($forAdmin)
                <tr>
                    <td style="padding:4px 30px 0;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eaf0f7;border-radius:12px;">
                            <tr>
                                <td style="padding:14px 18px;font-size:12px;line-height:1.6;color:#5e6a7a;">
                                    <strong style="color:#0f1d2e;">Returns &amp; Replacements</strong><br>
                                    Something arrived damaged or not as described? You have 7 days from delivery to
                                    request a return or replacement. Open
                                    <a href="{{ $siteUrl }}/track-order?order={{ $order->order_number }}" style="color:#0d4377;">Track Order</a>,
                                    enter this order number and your email, add a photo, and we'll arrange a pickup.
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
                @endunless

                <tr>
                    <td style="padding:20px 30px 30px;text-align:center;">
                        @php
                            // A guest has no account to sign into, so send them to the
                            // public tracking page; an account holder gets their order page.
                            $customerLink = $order->user_id
                                ? '/account/orders/'.$order->order_number
                                : '/track-order?order='.$order->order_number;
                        @endphp
                        <a href="{{ $siteUrl }}{{ $forAdmin ? '/admin/orders' : $customerLink }}"
                           style="display:inline-block;background:#042b52;color:#ffffff;text-decoration:none;padding:11px 26px;border-radius:999px;font-size:13px;">
                            {{ $forAdmin ? 'Open in admin' : ($order->user_id ? 'View your order' : 'Track your order') }}
                        </a>
                        @if(! $forAdmin && $supportEmail)
                            <p style="margin:16px 0 0;font-size:11.5px;color:#5e6a7a;">
                                Questions? Reply to this email or write to {{ $supportEmail }}.
                            </p>
                        @endif
                    </td>
                </tr>

            </table>
        </td>
    </tr>
</table>
</body>
</html>
