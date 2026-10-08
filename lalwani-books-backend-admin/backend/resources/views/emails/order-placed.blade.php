@php use App\Support\Money; @endphp
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $store }} — {{ $order->order_number }}</title>
</head>
<body style="margin:0;padding:0;background:#fbf1ee;font-family:-apple-system,Segoe UI,Arial,sans-serif;color:#2e2528;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbf1ee;padding:28px 12px;">
    <tr>
        <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;">

                <tr>
                    <td style="background:linear-gradient(135deg,#f8e9e4,#f2d3cd);padding:28px 30px;text-align:center;">
                        <p style="margin:0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#a5606c;">
                            {{ $forAdmin ? 'New order' : 'Thank you' }}
                        </p>
                        <h1 style="margin:8px 0 0;font-family:Georgia,serif;font-size:26px;font-weight:400;color:#2e2528;">
                            {{ $forAdmin ? 'An order just came in' : 'Your order is confirmed' }}
                        </h1>
                        <p style="margin:8px 0 0;font-size:13px;color:#6f5d59;">
                            Order <strong style="color:#2e2528;">{{ $order->order_number }}</strong>
                        </p>
                    </td>
                </tr>

                <tr>
                    <td style="padding:26px 30px 6px;">
                        @unless($forAdmin)
                            <p style="margin:0 0 18px;font-size:13.5px;line-height:1.6;color:#6f5d59;">
                                Hi {{ explode(' ', trim($order->ship_name))[0] ?: 'there' }}, we have your order and
                                it is being prepared. You will hear from us again when it ships.
                            </p>
                        @endunless

                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            @foreach($order->items as $item)
                                <tr>
                                    <td style="padding:9px 0;border-bottom:1px solid #f8e8e3;font-size:13px;color:#2e2528;">
                                        {{ $item->name }}
                                        <span style="color:#a08f8b;">&times; {{ $item->quantity }}</span>
                                    </td>
                                    <td align="right" style="padding:9px 0;border-bottom:1px solid #f8e8e3;font-size:13px;color:#2e2528;white-space:nowrap;">
                                        {{ Money::format($item->total) }}
                                    </td>
                                </tr>
                            @endforeach
                        </table>

                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;">
                            <tr>
                                <td style="padding:3px 0;font-size:12.5px;color:#6f5d59;">Subtotal</td>
                                <td align="right" style="padding:3px 0;font-size:12.5px;color:#6f5d59;">{{ Money::format($order->subtotal) }}</td>
                            </tr>
                            @if($order->discount > 0)
                                <tr>
                                    <td style="padding:3px 0;font-size:12.5px;color:#6f5d59;">Discount{{ $order->coupon_code ? ' ('.$order->coupon_code.')' : '' }}</td>
                                    <td align="right" style="padding:3px 0;font-size:12.5px;color:#a5606c;">-{{ Money::format($order->discount) }}</td>
                                </tr>
                            @endif
                            <tr>
                                <td style="padding:3px 0;font-size:12.5px;color:#6f5d59;">Shipping</td>
                                <td align="right" style="padding:3px 0;font-size:12.5px;color:#6f5d59;">
                                    {{ $order->shipping > 0 ? Money::format($order->shipping) : 'Free' }}
                                </td>
                            </tr>
                            <tr>
                                <td style="padding:3px 0;font-size:12.5px;color:#6f5d59;">{{ config('shop.tax_label', 'GST') }}</td>
                                <td align="right" style="padding:3px 0;font-size:12.5px;color:#6f5d59;">{{ Money::format($order->tax) }}</td>
                            </tr>
                            <tr>
                                <td style="padding:10px 0 0;border-top:1px solid #f8e8e3;font-size:15px;font-weight:600;">Total</td>
                                <td align="right" style="padding:10px 0 0;border-top:1px solid #f8e8e3;font-size:15px;font-weight:600;">
                                    {{ Money::format($order->total) }}
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>

                <tr>
                    <td style="padding:20px 30px 4px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbf1ee;border-radius:12px;">
                            <tr>
                                <td style="padding:16px 18px;font-size:12.5px;line-height:1.65;color:#6f5d59;">
                                    <strong style="color:#2e2528;">Delivering to</strong><br>
                                    {{ $order->ship_name }}<br>
                                    {{ $order->ship_address1 }}@if($order->ship_address2), {{ $order->ship_address2 }}@endif<br>
                                    {{ $order->ship_city }}, {{ $order->ship_state }} {{ $order->ship_zip }}<br>
                                    {{ $order->ship_phone }}
                                    <br><br>
                                    <strong style="color:#2e2528;">Payment</strong>
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
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbf1ee;border-radius:12px;">
                            <tr>
                                <td style="padding:14px 18px;font-size:12px;line-height:1.6;color:#6f5d59;">
                                    <strong style="color:#2e2528;">Returns &amp; Replacements</strong><br>
                                    Something arrived damaged or not as described? You have 7 days from delivery to
                                    request a return or replacement. Open
                                    <a href="{{ $siteUrl }}/track-order?order={{ $order->order_number }}" style="color:#a5606c;">Track Order</a>,
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
                           style="display:inline-block;background:#a5606c;color:#ffffff;text-decoration:none;padding:11px 26px;border-radius:999px;font-size:13px;">
                            {{ $forAdmin ? 'Open in admin' : ($order->user_id ? 'View your order' : 'Track your order') }}
                        </a>
                        @if(! $forAdmin && $supportEmail)
                            <p style="margin:16px 0 0;font-size:11.5px;color:#a08f8b;">
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
