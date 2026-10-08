<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>{{ $headline }}</title>
</head>
<body style="margin:0;padding:0;background:#faf4f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf4f3;padding:32px 16px;">
    <tr>
        <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:18px;overflow:hidden;">

                <tr>
                    <td style="padding:28px 32px 0;">
                        <p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#a5606c;">
                            {{ $store }}
                        </p>
                        <h1 style="margin:10px 0 0;font-size:22px;line-height:1.25;font-weight:600;color:#2e2528;">
                            {{ $headline }}
                        </h1>
                    </td>
                </tr>

                <tr>
                    <td style="padding:12px 32px 0;">
                        <p style="margin:0;font-size:14px;line-height:1.6;color:#4a3b3e;">
                            Hi {{ $name }}, {{ $body }}
                        </p>
                    </td>
                </tr>

                <tr>
                    <td style="padding:20px 32px 0;">
                        <div style="background:#faf0ee;border-radius:12px;padding:16px 18px;">
                            <p style="margin:0;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#a08f8b;">Order</p>
                            <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#2e2528;">{{ $order->order_number }}</p>

                            @if($status === 'shipped' && $order->awb_code)
                                <p style="margin:14px 0 0;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#a08f8b;">Courier</p>
                                <p style="margin:4px 0 0;font-size:14px;color:#4a3b3e;">
                                    {{ $order->courier_name ?: 'Assigned' }} &middot; AWB {{ $order->awb_code }}
                                </p>
                            @endif
                        </div>
                    </td>
                </tr>

                @if($status === 'shipped' && $order->tracking_url)
                    <tr>
                        <td style="padding:20px 32px 0;">
                            <a href="{{ $order->tracking_url }}"
                               style="display:inline-block;background:#74474f;color:#ffffff;text-decoration:none;font-size:14px;padding:12px 26px;border-radius:999px;">
                                Track your parcel
                            </a>
                        </td>
                    </tr>
                @endif

                <tr>
                    <td style="padding:22px 32px 0;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            @foreach($order->items as $item)
                                <tr>
                                    <td style="padding:6px 0;font-size:13px;color:#4a3b3e;">
                                        {{ $item->name }} &times; {{ $item->quantity }}
                                    </td>
                                </tr>
                            @endforeach
                        </table>
                    </td>
                </tr>

                <tr>
                    <td style="padding:22px 32px 30px;">
                        <p style="margin:0;padding-top:18px;border-top:1px solid #f0e3e1;font-size:11.5px;color:#a08f8b;">
                            @if($supportEmail)
                                Questions about this order? Write to {{ $supportEmail }}.
                            @else
                                Questions about this order? Just reply to this email.
                            @endif
                        </p>
                    </td>
                </tr>

            </table>
        </td>
    </tr>
</table>
</body>
</html>
