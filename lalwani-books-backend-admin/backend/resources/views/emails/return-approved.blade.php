<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Your return request is approved</title>
</head>
<body style="margin:0;padding:0;background:#f0f3f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f3f7;padding:32px 16px;">
    <tr>
        <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:18px;overflow:hidden;">

                <tr>
                    <td bgcolor="#042b52" style="background:#042b52;padding:18px 32px;border-bottom:3px solid #e8b04b;">
                        <p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:600;color:#e8b04b;">
                            {{ $store }}
                        </p>
                    </td>
                </tr>

                <tr>
                    <td style="padding:24px 32px 0;">
                        <h1 style="margin:0;font-size:22px;line-height:1.25;font-weight:600;color:#0f1d2e;">
                            Your return request is approved
                        </h1>
                    </td>
                </tr>

                <tr>
                    <td style="padding:12px 32px 0;">
                        <p style="margin:0;font-size:14px;line-height:1.6;color:#3a4757;">
                            Hi {{ $name }}, {{ lcfirst($body) }}
                        </p>
                    </td>
                </tr>

                <tr>
                    <td style="padding:20px 32px 0;">
                        <div style="background:#eaf0f7;border-radius:12px;padding:16px 18px;">
                            <p style="margin:0;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#5e6a7a;">Order</p>
                            <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#0f1d2e;">{{ $order?->order_number }}</p>

                            <p style="margin:14px 0 0;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#5e6a7a;">Request</p>
                            <p style="margin:4px 0 0;font-size:14px;color:#3a4757;">{{ $kind }} &middot; {{ $return->reason }}</p>

                            @if($amount)
                                <p style="margin:14px 0 0;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#5e6a7a;">Refund amount</p>
                                <p style="margin:4px 0 0;font-size:20px;font-weight:600;color:#047857;">{{ $amount }}</p>
                            @endif

                            <p style="margin:14px 0 0;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#5e6a7a;">Pickup</p>
                            <p style="margin:4px 0 0;font-size:14px;color:#3a4757;">
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
                            <p style="margin:0;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#5e6a7a;">Note from us</p>
                            <p style="margin:4px 0 0;font-size:13.5px;line-height:1.6;color:#3a4757;">{{ $note }}</p>
                        </td>
                    </tr>
                @endif

                @if(! empty($return->items))
                    <tr>
                        <td style="padding:22px 32px 0;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                @foreach($return->items as $item)
                                    <tr>
                                        <td style="padding:6px 0;font-size:13px;color:#3a4757;">
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
                        <p style="margin:0;padding-top:18px;border-top:1px solid #e0e6ee;font-size:11.5px;color:#5e6a7a;">
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
