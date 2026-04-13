import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | AURA",
  description: "Privacy policy for AURA wallpaper platform.",
};

export default function PrivacyPage() {
  const lastUpdated = "April 13, 2026";

  return (
    <main
      className="min-h-screen pt-24 pb-16 px-6 md:px-12"
      style={{ background: "var(--bg-primary)" }}
    >
      <div className="max-w-2xl mx-auto">
        <Link
          href="/"
          className="text-xs tracking-widest uppercase transition-opacity hover:opacity-60 mb-8 inline-block"
          style={{ color: "var(--text-muted)" }}
        >
          ← Back to AURA
        </Link>

        <h1
          className="text-3xl font-bold mb-2"
          style={{ color: "var(--text-primary)" }}
        >
          Privacy Policy
        </h1>
        <p className="text-sm mb-10" style={{ color: "var(--text-muted)" }}>
          Last updated: {lastUpdated}
        </p>

        <div className="space-y-8" style={{ color: "var(--text-secondary)" }}>

          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
              1. Introduction
            </h2>
            <p className="text-sm leading-relaxed">
              AURA (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) operates aurawalls.site. This Privacy Policy explains
              how we collect, use, and protect your information when you use our platform.
              By using AURA, you agree to the practices described in this policy.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
              2. Information We Collect
            </h2>
            <p className="text-sm leading-relaxed mb-3">
              We collect the following information:
            </p>
            <ul className="text-sm leading-relaxed space-y-2 list-disc list-inside">
              <li><strong>Email address</strong> — used for account creation and authentication via OTP</li>
              <li><strong>Username and display name</strong> — used for your public profile</li>
              <li><strong>Profile photo and cover image</strong> — uploaded by you, stored on Cloudflare R2</li>
              <li><strong>Usage data</strong> — pages visited, wallpapers viewed, downloaded, and liked</li>
              <li><strong>Device information</strong> — browser type, operating system, IP address</li>
              <li><strong>Uploaded content</strong> — wallpapers you upload as a creator</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
              3. How We Use Your Information
            </h2>
            <ul className="text-sm leading-relaxed space-y-2 list-disc list-inside">
              <li>To provide and improve the AURA platform</li>
              <li>To authenticate your account via email OTP</li>
              <li>To personalize your wallpaper discovery experience</li>
              <li>To track download counts and platform analytics</li>
              <li>To display relevant advertisements via Google AdSense</li>
              <li>To communicate important updates about your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
              4. Advertising
            </h2>
            <p className="text-sm leading-relaxed mb-3">
              AURA uses Google AdSense to display advertisements. Google AdSense may use
              cookies and similar technologies to show you personalized ads based on your
              interests and browsing behavior.
            </p>
            <p className="text-sm leading-relaxed mb-3">
              Google&apos;s use of advertising cookies enables it and its partners to serve ads
              based on your visits to AURA and other websites. You can opt out of
              personalized advertising by visiting{" "}
              <a
                href="https://www.google.com/settings/ads"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--accent)" }}
              >
                Google Ad Settings
              </a>.
            </p>
            <p className="text-sm leading-relaxed">
              For more information on how Google uses data, visit{" "}
              <a
                href="https://policies.google.com/technologies/partner-sites"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--accent)" }}
              >
                Google&apos;s Privacy & Terms
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
              5. Cookies
            </h2>
            <p className="text-sm leading-relaxed">
              AURA uses cookies for authentication (httpOnly session cookie) and analytics.
              Third-party services like Google AdSense may also set cookies on your device.
              You can control cookie preferences through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
              6. Data Storage and Security
            </h2>
            <p className="text-sm leading-relaxed">
              Your data is stored securely on Supabase (PostgreSQL) and Cloudflare R2.
              We use industry-standard encryption (HTTPS/TLS) for all data transmission.
              Passwords are hashed using bcrypt and never stored in plain text.
              Authentication tokens are stored in httpOnly cookies inaccessible to JavaScript.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
              7. Data Sharing
            </h2>
            <p className="text-sm leading-relaxed">
              We do not sell your personal data. We share data only with:
            </p>
            <ul className="text-sm leading-relaxed space-y-2 list-disc list-inside mt-3">
              <li><strong>Cloudflare</strong> — CDN, security, and image storage</li>
              <li><strong>Supabase</strong> — database hosting</li>
              <li><strong>Google AdSense</strong> — advertising (anonymized usage data)</li>
              <li><strong>Sightengine</strong> — content moderation for uploaded images</li>
              <li><strong>Brevo</strong> — email delivery for OTP authentication</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
              8. Your Rights
            </h2>
            <ul className="text-sm leading-relaxed space-y-2 list-disc list-inside">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Delete your account and associated data from your profile page</li>
              <li>Opt out of personalized advertising</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
              9. Children&apos;s Privacy
            </h2>
            <p className="text-sm leading-relaxed">
              AURA is not directed at children under 13. We do not knowingly collect
              personal information from children under 13. If you believe a child has
              provided us with personal information, please contact us.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
              10. Contact
            </h2>
            <p className="text-sm leading-relaxed">
              For privacy-related questions or data requests, contact us at{" "}
              <a
                href="mailto:privacy@aurawalls.site"
                style={{ color: "var(--accent)" }}
              >
                privacy@aurawalls.site
              </a>
            </p>
          </section>

        </div>
      </div>
    </main>
  );
}