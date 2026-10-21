// Builds supabase/email-templates/*.html from one layout, so the three auth
// emails stay identical in look. Paste each output into Supabase →
// Authentication → Email Templates. Email-safe: tables, inline styles, a
// bulletproof button and a plain-link fallback; no web fonts or scripts.
import fs from 'node:fs';

const LOGO = 'https://youdo-app.vercel.app/icon-192.png';
const SITE = 'https://youdo-app.vercel.app';
const ACCENT = '#d8b47a';

const templates = [
  {
    file: 'confirm-sign-up.html',
    title: 'Confirm your YouDO email',
    preheader: 'One tap to finish setting up your YouDO account.',
    eyebrow: 'Welcome to YouDO',
    heading: 'Confirm your email',
    body: 'Thanks for joining. Confirm this address to finish setting up your account, then come back to YouDO and sign in.',
    button: 'Confirm email address',
    note: "Didn't create a YouDO account? You can safely ignore this email; nothing will be set up.",
  },
  {
    file: 'reset-password.html',
    title: 'Reset your YouDO password',
    preheader: 'Choose a new password for your YouDO account.',
    eyebrow: 'Account security',
    heading: 'Reset your password',
    body: 'We received a request to reset your YouDO password. Tap the button to choose a new one.',
    button: 'Choose a new password',
    note: "Didn't ask for this? Ignore this email and your password stays the same. If you asked more than once, use the newest email.",
  },
  {
    file: 'change-email-address.html',
    title: 'Confirm your new YouDO email',
    preheader: 'Confirm the change of your YouDO account email.',
    eyebrow: 'Account security',
    heading: 'Confirm your email change',
    body: 'Someone asked to change your YouDO account email to <strong style="color:#f5f2ec;">{{ .NewEmail }}</strong>. Confirm from this inbox to continue; you may also need to confirm from the other inbox.',
    button: 'Confirm email change',
    note: "Didn't ask for this? Don't open the link. Your current email stays in place until every confirmation is complete.",
  },
];

const page = (t) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${t.title}</title>
</head>
<body style="margin:0;padding:0;background:#0f0e0c;color:#f5f2ec;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#0f0e0c;">${t.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0f0e0c;">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
    <tr><td style="padding:0 4px 20px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="vertical-align:middle;"><img src="${LOGO}" width="36" height="36" alt="" style="display:block;border:0;border-radius:9px;"></td>
        <td style="vertical-align:middle;padding-left:10px;font-size:20px;font-weight:700;letter-spacing:-0.01em;color:#f5f2ec;">You<span style="color:${ACCENT};">DO</span></td>
      </tr></table>
    </td></tr>
    <tr><td style="background:#1c1a17;border:1px solid #33302a;border-radius:20px;overflow:hidden;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="height:4px;line-height:4px;font-size:0;background:${ACCENT};background-image:linear-gradient(90deg,${ACCENT},#e9cf9f 50%,${ACCENT});">&nbsp;</td></tr>
        <tr><td style="padding:32px 28px 28px;">
          <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${ACCENT};">${t.eyebrow}</p>
          <h1 style="margin:0 0 14px;font-size:26px;line-height:1.25;font-weight:700;letter-spacing:-0.015em;color:#f5f2ec;">${t.heading}</h1>
          <p style="margin:0 0 28px;font-size:16px;line-height:1.6;color:#d5cfc5;">${t.body}</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;"><tr>
            <td align="center" bgcolor="${ACCENT}" style="border-radius:12px;background:${ACCENT};">
              <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:15px 26px;font-size:16px;font-weight:700;line-height:1;color:#171612;text-decoration:none;border-radius:12px;">${t.button} &rarr;</a>
            </td>
          </tr></table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr>
            <td style="padding:14px 16px;background:#24211d;border:1px solid #33302a;border-radius:12px;font-size:13px;line-height:1.55;color:#ada69b;">&#128274;&nbsp; ${t.note}</td>
          </tr></table>
          <p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:#8a8378;">Button not working? Copy this link into your browser:</p>
          <p style="margin:0;font-size:12px;line-height:1.5;word-break:break-all;"><a href="{{ .ConfirmationURL }}" style="color:${ACCENT};text-decoration:underline;">{{ .ConfirmationURL }}</a></p>
        </td></tr>
      </table>
    </td></tr>
    <tr><td align="center" style="padding:22px 12px 0;font-size:12px;line-height:1.6;color:#6f695f;">
      This link works once and expires soon, so use it right away.<br>
      Sent by <a href="${SITE}" style="color:#8a8378;text-decoration:underline;">YouDO</a> &middot; Built for serious aspirants
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>
`;

for (const t of templates) fs.writeFileSync(new URL(`../supabase/email-templates/${t.file}`, import.meta.url), page(t));
console.log('wrote', templates.length);
