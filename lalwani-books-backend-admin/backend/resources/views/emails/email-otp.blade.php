<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>{{ $store }} — verification code</title>
</head>
<body style="margin:0;padding:0;background:#faf4f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf4f3;padding:32px 16px;">
    <tr>
        <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:18px;overflow:hidden;">

                <tr>
                    <td style="padding:28px 32px 0;">
                        <p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#a5606c;">
                            {{ $store }}
                        </p>
                    </td>
                </tr>

                <tr>
                    <td style="padding:14px 32px 0;">
                        <p style="margin:0;font-size:14.5px;line-height:1.6;color:#4a3b3e;">
                            Hi {{ $name }}, use this code to confirm your email address.
                        </p>
                    </td>
                </tr>

                <tr>
                    <td align="center" style="padding:24px 32px 0;">
                        <div style="background:#faf0ee;border-radius:14px;padding:20px 12px;">
                            <span style="font-size:34px;font-weight:700;letter-spacing:10px;color:#2e2528;">{{ $code }}</span>
                        </div>
                    </td>
                </tr>

                <tr>
                    <td style="padding:18px 32px 0;">
                        <p style="margin:0;font-size:12.5px;line-height:1.6;color:#6f5d59;">
                            It stops working in {{ $minutes }} minutes. If you did not create an account,
                            you can ignore this email — nothing will happen.
                        </p>
                    </td>
                </tr>

                <tr>
                    <td style="padding:22px 32px 30px;">
                        <p style="margin:0;padding-top:18px;border-top:1px solid #f0e3e1;font-size:11.5px;color:#a08f8b;">
                            Nobody from {{ $store }} will ever ask you for this code.
                            @if($supportEmail)
                                Questions? Write to {{ $supportEmail }}.
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
