import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.BREVO_SMTP_USER,
    pass: process.env.BREVO_SMTP_PASS,
  },
});

export async function sendOTPEmail(
  email: string,
  otp: string,
  type: "signup" | "login" | "password_reset"
): Promise<void> {
  const subjects = {
    signup: "Verify your AURA account",
    login: "Your AURA login code",
    password_reset: "Reset your AURA password",
  };

  const messages = {
    signup: "to verify your email and complete signup",
    login: "to sign in to your account",
    password_reset: "to reset your password",
  };

  const result = await transporter.sendMail({
    from: `"AURA" <${process.env.BREVO_FROM_EMAIL}>`,
    to: email,
    subject: subjects[type],
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; background: #0a0a0a; color: #f5f0eb;">
        <h1 style="font-size: 28px; font-weight: 700; letter-spacing: 0.2em; color: #C9A84C; margin-bottom: 8px;">
          AURA
        </h1>
        <p style="color: #888; font-size: 12px; letter-spacing: 0.3em; text-transform: uppercase; margin-bottom: 40px;">
          Visual Culture
        </p>
        <p style="color: #f5f0eb; font-size: 16px; margin-bottom: 24px;">
          Use the code below ${messages[type]}:
        </p>
        <div style="background: #111; border: 1px solid #1a1a1a; border-radius: 12px; padding: 32px; text-align: center; margin-bottom: 32px;">
          <p style="font-size: 42px; font-weight: 700; letter-spacing: 0.3em; color: #C9A84C; margin: 0; font-family: monospace;">
            ${otp}
          </p>
        </div>
        <p style="color: #888; font-size: 14px; margin-bottom: 8px;">
          This code expires in <strong style="color: #f5f0eb;">15 minutes</strong>.
        </p>
        <p style="color: #888; font-size: 14px;">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });

  console.log("Email sent:", result.messageId);
}