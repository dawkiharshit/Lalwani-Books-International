<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Your return request is approved</title>
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
                            Your return request is approved
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
                            <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#2e2528;">{{ $order?->order_number }}</p>

                            <p style="margin:14px 0 0;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#a08f8b;">Request</p>
                            <p style="margin:4px 0 0;font-size:14px;color:#4a3b3e;">{{ $kind }} &middot; {{ $return->reason }}</p>

                            <p style="margin:14px 0 0;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#a08f8b;">Pickup</p>
                            <p style="margin:4px 0 0;font-size:14px;color:#4a3b3e;">
                                @if($pickupBooked)
                                    A courier pickup has been booked. Please keep the item packed and ready.
                                @else
                                    We will be in touch shortly to arrange the pickup.
                                @endif
                            </p>
                        </div>
                    </td>
                </tr>

                @if($note !== '')
                    <tr>
                        <td style="padding:16px 32px 0;">
                            <p style="margin:0;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#a08f8b;">Note from us</p>
                            <p style="margin:4px 0 0;font-size:13.5px;line-height:1.6;color:#4a3b3e;">{{ $note }}</p>
                        </td>
                    </tr>
                @endif

                @if(! empty($return->items))
                    <tr>
                        <td style="padding:22px 32px 0;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                @foreach($return->items as $item)
                                    <tr>
                                        <td style="padding:6px 0;font-size:13px;color:#4a3b3e;">
                                            {{ $item['name'] ?? 'Item' }} &times; {{ $item['quantity'] ?? 1 }}
                                        </td>
                                    </tr>
                                @endforeach
                            </table>
                        </td>
                    </tr>
                @endif

                <tr>
                    <td style="padding:22px 32px 30px;">
                        <p style="margin:0;padding-top:18px;border-top:1px solid #f0e3e1;font-size:11.5px;color:#a08f8b;">
                            @if($supportEmail)
                                Questions about this return? Write to {{ $supportEmail }}.
                            @else
                                Questions about this return? Just reply to this email.
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
