const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

/** Mirrors apps/web/app/globals.css — keep in sync for brand consistency */
const THEME = {
  bg: "#0a0a0a",
  surface: "#111111",
  elevated: "#1a1a1a",
  text: "#f5f0eb",
  muted: "#888888",
  dim: "#444444",
  border: "1px solid rgba(255,255,255,0.08)",
  accent: "#40C057",
  accentGlow: "rgba(64, 192, 87, 0.18)",
} as const;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildOtpEmailHtml(
  otp: string,
  type: "signup" | "login" | "password_reset"
): string {
  const safeOtp = escapeHtml(otp);

  const subjects = {
    signup: {
      eyebrow: "Welcome",
      title: "Verify your email",
      lead: "You’re one step away from Aurora. Enter this code to confirm your address and finish creating your account.",
    },
    login: {
      eyebrow: "Sign in",
      title: "Your login code",
      lead: "Use the code below to sign in. It’s valid for a short time and can only be used once.",
    },
    password_reset: {
      eyebrow: "Security",
      title: "Reset your password",
      lead: "We received a request to reset the password for your Aurora account. Use this code to continue.",
    },
  }[type];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Aurora</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${THEME.bg};-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${THEME.bg};">
    <tr>
      <td align="center" style="padding:48px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;">
          <!-- Accent rail -->
          <tr>
            <td style="height:3px;border-radius:999px;background:linear-gradient(90deg, ${THEME.accent} 0%, rgba(64,192,87,0.35) 50%, ${THEME.accent} 100%);background-color:${THEME.accent};"></td>
          </tr>
          <tr>
            <td style="height:28px;line-height:28px;font-size:0;">&nbsp;</td>
          </tr>
          <!-- Header -->
          <tr>
            <td align="left">
              <p style="margin:0 0 4px 0;font-family:Georgia,'Times New Roman',serif;font-size:11px;font-weight:600;letter-spacing:0.28em;text-transform:uppercase;color:${THEME.accent};">
                ${subjects.eyebrow}
              </p>
              <h1 style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:28px;font-weight:700;letter-spacing:-0.02em;line-height:1.15;color:${THEME.text};">
                ${subjects.title}
              </h1>
              <p style="margin:0 0 28px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:13px;font-weight:500;letter-spacing:0.2em;text-transform:uppercase;color:${THEME.dim};">
                Aurora · Visual culture
              </p>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background-color:${THEME.surface};border:${THEME.border};border-radius:16px;padding:28px 28px 32px 28px;">
              <p style="margin:0 0 24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:1.6;color:${THEME.muted};">
                ${subjects.lead}
              </p>
              <p style="margin:0 0 10px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:${THEME.dim};">
                Your code
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${THEME.elevated};border-radius:12px;border:1px solid rgba(255,255,255,0.06);">
                <tr>
                  <td align="center" style="padding:28px 20px;">
                    <p style="margin:0;font-family:'SF Mono','Consolas','Liberation Mono',Menlo,monospace;font-size:36px;font-weight:700;letter-spacing:0.35em;color:${THEME.accent};line-height:1.2;">
                      ${safeOtp}
                    </p>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px;">
                <tr>
                  <td style="padding:14px 16px;border-radius:10px;background-color:${THEME.accentGlow};border:1px solid rgba(64,192,87,0.25);">
                    <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:13px;line-height:1.5;color:${THEME.text};">
                      <strong style="color:${THEME.accent};">Expires in 15 minutes.</strong>
                      For your security, don’t share this code with anyone.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="height:32px;line-height:32px;font-size:0;">&nbsp;</td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center">
              <p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:13px;line-height:1.55;color:${THEME.muted};max-width:400px;">
                If you didn’t request this email, you can ignore it. Your account stays secure.
              </p>
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:12px;color:${THEME.dim};">
                © ${new Date().getFullYear()} Aurora · <a href="https://www.aurora-walls.com" style="color:${THEME.accent};text-decoration:none;">aurora-walls.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendOTPEmail(
  email: string,
  otp: string,
  type: "signup" | "login" | "password_reset"
): Promise<void> {
  const subjects = {
    signup: "Verify your Aurora account",
    login: "Your Aurora login code",
    password_reset: "Reset your Aurora password",
  };

  const htmlContent = buildOtpEmailHtml(otp, type);

  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": process.env.BREVO_API_KEY!,
    },
    body: JSON.stringify({
      sender: { name: "Aurora", email: process.env.BREVO_FROM_EMAIL },
      to: [{ email }],
      subject: subjects[type],
      htmlContent,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Brevo API error (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as { messageId?: string };
  console.log("Email sent:", data.messageId);
}
