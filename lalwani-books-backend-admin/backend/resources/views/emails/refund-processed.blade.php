<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Your refund has been processed</title>
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
                            Your refund has been processed
                        </h1>
                    </td>
                </tr>

                <tr>
                    <td style="padding:12px 32px 0;">
                        <p style="margin:0;font-size:14px;line-height:1.6;color:#3a4757;">
                            Hi {{ $name }}, we have processed a refund of <strong>{{ $amount }}</strong> for your return. {{ $when }}
                        </p>
                    </td>
                </tr>

                <tr>
                    <td style="padding:20px 32px 0;">
                        <div style="background:#eaf0f7;border-radius:12px;padding:16px 18px;">
                            <p style="margin:0;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#5e6a7a;">Refund amount</p>
                            <p style="margin:4px 0 0;font-size:20px;font-weight:600;color:#047857;">{{ $amount }}</p>

                            <p style="margin:14px 0 0;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#5e6a7a;">Refunded to</p>
                            <p style="margin:4px 0 0;font-size:14px;color:#3a4757;">{{ $destination }}</p>

                            <p style="margin:14px 0 0;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#5e6a7a;">Order</p>
                            <p style="margin:4px 0 0;font-size:14px;color:#3a4757;">{{ $order?->order_number }}</p>

                            @if($return->refund_id)
                                <p style="margin:14px 0 0;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#5e6a7a;">Refund reference</p>
                                <p style="margin:4px 0 0;font-size:13px;font-family:Menlo,Consolas,monospace;color:#3a4757;">{{ $return->refund_id }}</p>
                            @endif
                        </div>
                    </td>
                </tr>

                <tr>
                    <td style="padding:22px 32px 30px;">
                        <p style="margin:0;padding-top:18px;border-top:1px solid #e0e6ee;font-size:11.5px;color:#5e6a7a;">
                            @if($supportEmail)
                                Haven't received it in time? Write to {{ $supportEmail }} with the details above.
                            @else
                                Haven't received it in time? Just reply to this email.
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
