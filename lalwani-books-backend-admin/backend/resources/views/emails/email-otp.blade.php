<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>{{ $store }} — verification code</title>
</head>
<body style="margin:0;padding:0;background:#f0f3f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f3f7;padding:32px 16px;">
    <tr>
        <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:18px;overflow:hidden;">

                <tr>
                    <td bgcolor="#042b52" style="background:#042b52;padding:18px 32px;border-bottom:3px solid #e8b04b;">
                        <p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:600;color:#e8b04b;">
                            {{ $store }}
                        </p>
                    </td>
                </tr>

                <tr>
                    <td style="padding:24px 32px 0;">
                        <p style="margin:0;font-size:14.5px;line-height:1.6;color:#3a4757;">
                            Hi {{ $name }}, use this code to confirm your email address.
                        </p>
                    </td>
                </tr>

                <tr>
                    <td align="center" style="padding:24px 32px 0;">
                        <div style="background:#eaf0f7;border-radius:14px;padding:20px 12px;">
                            <span style="font-size:34px;font-weight:700;letter-spacing:10px;color:#042b52;">{{ $code }}</span>
                        </div>
                    </td>
                </tr>

                <tr>
                    <td style="padding:18px 32px 0;">
                        <p style="margin:0;font-size:12.5px;line-height:1.6;color:#5e6a7a;">
                            It stops working in {{ $minutes }} minutes. If you did not create an account,
                            you can ignore this email — nothing will happen.
                        </p>
                    </td>
                </tr>

                <tr>
                    <td style="padding:22px 32px 30px;">
                        <p style="margin:0;padding-top:18px;border-top:1px solid #e0e6ee;font-size:11.5px;color:#5e6a7a;">
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
