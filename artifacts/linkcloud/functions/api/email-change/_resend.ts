import type { Env } from "./_common";

export async function sendEmailViaResend({
  to,
  subject,
  html,
  env,
}: {
  to: string;
  subject: string;
  html: string;
  env: Env;
}): Promise<{ id: string }> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY environment variable is not configured on the server.");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "LinkCloud Security <verify@linkcloud.in>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error("[RESEND] API error:", res.status, errBody);
    throw new Error(`Failed to send email via Resend (${res.status}): ${errBody}`);
  }

  const data: any = await res.json();
  return { id: data.id };
}

export function buildEmailChangeTemplate({
  verificationLink,
  newEmail,
  expiresInMinutes = 5,
}: {
  verificationLink: string;
  newEmail: string;
  expiresInMinutes?: number;
}): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm Your LinkCloud Email Change</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
  <div style="max-width: 560px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 32px 32px 24px; text-align: center;">
      <div style="display: inline-block; padding: 8px 16px; background: rgba(255, 255, 255, 0.15); border-radius: 9999px; margin-bottom: 12px;">
        <span style="color: #ffffff; font-size: 13px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;">LinkCloud Security</span>
      </div>
      <h1 style="color: #ffffff; font-size: 22px; font-weight: 800; margin: 0; line-height: 1.3;">Verify Your New Email Address</h1>
    </div>

    <!-- Body -->
    <div style="padding: 32px;">
      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px;">
        Hello,
      </p>
      <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 24px;">
        We received a request to change your LinkCloud account email to <strong style="color: #0f172a;">${newEmail}</strong>.
      </p>
      
      <!-- Call to Action -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${verificationLink}" target="_blank" style="display: inline-block; background-color: #4f46e5; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.3);">
          Confirm Email Change
        </a>
      </div>

      <!-- Expiry Notice -->
      <div style="background-color: #fef3c7; border: 1px solid #fde68a; border-radius: 10px; padding: 12px 16px; margin-bottom: 24px;">
        <p style="font-size: 13px; color: #92400e; margin: 0; line-height: 1.5;">
          ⏱️ <strong>This link is valid for ${expiresInMinutes} minutes only.</strong> If not verified within ${expiresInMinutes} minutes, you will need to request a new link.
        </p>
      </div>

      <p style="font-size: 13px; color: #64748b; line-height: 1.6; margin: 0 0 16px;">
        If button above doesn't work, copy and paste this link into your browser:
      </p>
      <div style="background-color: #f1f5f9; padding: 10px 14px; border-radius: 8px; word-break: break-all; font-family: monospace; font-size: 12px; color: #475569; margin-bottom: 24px;">
        ${verificationLink}
      </div>

      <p style="font-size: 13px; color: #94a3b8; line-height: 1.5; margin: 0; border-top: 1px solid #f1f5f9; padding-top: 20px;">
        If you did not request this email change, please ignore this message or update your password immediately to secure your account.
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 32px; text-align: center;">
      <p style="font-size: 12px; color: #94a3b8; margin: 0;">
        © ${new Date().getFullYear()} LinkCloud. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
`;
}
