import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Aurora",
  description:
    "How Aurora collects, uses, and protects your data — including AdSense, cookies, third parties, and your rights.",
};

const SECTIONS: Array<{ heading: string; body: React.ReactNode }> = [
  {
    heading: "1. Introduction",
    body: (
      <p>
        Aurora (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) operates{" "}
        <a
          href="https://www.aurora-walls.com"
          className="underline-offset-2 hover:underline"
          style={{ color: "var(--accent)" }}
        >
          aurora-walls.com
        </a>{" "}
        — a wallpaper discovery, download, and curation platform. This Privacy
        Policy explains what information we collect when you visit Aurora, how
        we use it, and the choices you have. By using Aurora you agree to the
        practices described below.
      </p>
    ),
  },
  {
    heading: "2. Information We Collect",
    body: (
      <ul className="space-y-2 list-disc list-inside">
        <li>
          <strong>Account information</strong> — email address and username
          when you sign up, plus optional profile photo and display name.
        </li>
        <li>
          <strong>Usage data</strong> — pages visited, wallpapers viewed, liked,
          bookmarked, and downloaded, including timestamps.
        </li>
        <li>
          <strong>Device information</strong> — browser, operating system, IP
          address, and screen resolution (used to deliver the right file size
          and format for your display).
        </li>
        <li>
          <strong>Cookies and similar technologies</strong> — used for
          authentication, analytics, and advertising. See Section 5.
        </li>
      </ul>
    ),
  },
  {
    heading: "3. How We Use Your Information",
    body: (
      <ul className="space-y-2 list-disc list-inside">
        <li>To provide, operate, and improve the Aurora service.</li>
        <li>
          To personalize wallpaper recommendations based on what you&apos;ve
          liked, downloaded, or viewed.
        </li>
        <li>
          To send account-related emails such as authentication codes,
          security notifications, and important policy updates. We do not send
          marketing emails without your explicit consent.
        </li>
        <li>
          To serve relevant advertisements via Google AdSense and other
          advertising partners.
        </li>
        <li>To detect, prevent, and respond to fraud or abuse.</li>
      </ul>
    ),
  },
  {
    heading: "4. Google AdSense & Advertising",
    body: (
      <div className="space-y-4">
        <p>
          Aurora displays advertisements through Google AdSense. Google, as a
          third-party vendor, uses cookies to serve ads based on your prior
          visits to Aurora and other websites.
        </p>
        <p>
          You can opt out of personalized advertising by visiting{" "}
          <a
            href="https://www.google.com/settings/ads"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-2 hover:underline"
            style={{ color: "var(--accent)" }}
          >
            google.com/settings/ads
          </a>
          . You may also opt out of third-party vendor cookie use by visiting{" "}
          <a
            href="https://www.aboutads.info"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-2 hover:underline"
            style={{ color: "var(--accent)" }}
          >
            aboutads.info
          </a>
          .
        </p>
        <p>
          Aurora does not control the content of ads served by Google or its
          partners. If you encounter an ad that violates Google&apos;s policies,
          report it directly through Google AdSense reporting tools.
        </p>
      </div>
    ),
  },
  {
    heading: "5. Cookies",
    body: (
      <div className="space-y-4">
        <p>Aurora uses three categories of cookies:</p>
        <ul className="space-y-2 list-disc list-inside">
          <li>
            <strong>Essential cookies</strong> — required for authentication and
            session persistence. Without these, you cannot stay logged in.
          </li>
          <li>
            <strong>Analytics cookies</strong> — anonymous usage data to help us
            understand which content resonates and where the experience can
            improve.
          </li>
          <li>
            <strong>Advertising cookies</strong> — set by Google AdSense to
            measure ad performance and (where applicable) personalize ad
            content.
          </li>
        </ul>
        <p>
          You can disable cookies at any time through your browser settings.
          Disabling essential cookies will prevent you from signing in or
          accessing account features.
        </p>
      </div>
    ),
  },
  {
    heading: "6. Data Sharing",
    body: (
      <div className="space-y-4">
        <p>
          We do not sell your personal data. We share data only with the
          following processors, strictly to operate the service:
        </p>
        <ul className="space-y-2 list-disc list-inside">
          <li>
            <strong>Supabase</strong> — managed PostgreSQL database hosting.
          </li>
          <li>
            <strong>Cloudflare</strong> — CDN, security, and image delivery.
          </li>
          <li>
            <strong>Google</strong> — AdSense advertising and (where enabled)
            Google Analytics.
          </li>
        </ul>
        <p>
          We may also disclose information when required by law, court order,
          or a valid governmental request.
        </p>
      </div>
    ),
  },
  {
    heading: "7. Data Retention",
    body: (
      <p>
        We retain your account data for as long as your account remains active.
        If you delete your account, your profile and associated personal data
        are removed from our active systems within 30 days. Anonymized usage
        statistics may be retained for analytics purposes.
      </p>
    ),
  },
  {
    heading: "8. Your Rights",
    body: (
      <div className="space-y-4">
        <p>You have the right to:</p>
        <ul className="space-y-2 list-disc list-inside">
          <li>Access the personal data we hold about you.</li>
          <li>Request correction of inaccurate information.</li>
          <li>Request deletion of your account and associated data.</li>
          <li>Withdraw consent for marketing communications at any time.</li>
          <li>Opt out of personalized advertising (see Section 4).</li>
        </ul>
        <p>
          To exercise any of these rights, email{" "}
          <a
            href="mailto:amrawatshubham@gmail.com"
            className="underline-offset-2 hover:underline"
            style={{ color: "var(--accent)" }}
          >
            amrawatshubham@gmail.com
          </a>{" "}
          from the email address associated with your account.
        </p>
      </div>
    ),
  },
  {
    heading: "9. Children's Privacy",
    body: (
      <p>
        Aurora is not directed to children under the age of 13. We do not
        knowingly collect personal information from children under 13. If you
        believe a child has provided us with personal information, please
        contact{" "}
        <a
          href="mailto:amrawatshubham@gmail.com"
          className="underline-offset-2 hover:underline"
          style={{ color: "var(--accent)" }}
        >
          amrawatshubham@gmail.com
        </a>{" "}
        and we will promptly delete the relevant data.
      </p>
    ),
  },
  {
    heading: "10. Changes to This Policy",
    body: (
      <p>
        We may update this Privacy Policy from time to time as the service
        evolves. When we make material changes, we&apos;ll notify registered
        users by email and update the &quot;Last updated&quot; date at the top
        of this page. Your continued use of Aurora after changes take effect
        constitutes acceptance of the revised policy.
      </p>
    ),
  },
  {
    heading: "11. Contact",
    body: (
      <p>
        For any privacy-related questions, requests, or concerns, reach us at{" "}
        <a
          href="mailto:amrawatshubham@gmail.com"
          className="underline-offset-2 hover:underline"
          style={{ color: "var(--accent)" }}
        >
          amrawatshubham@gmail.com
        </a>
        . You can also use our{" "}
        <Link
          href="/contact"
          className="underline-offset-2 hover:underline"
          style={{ color: "var(--accent)" }}
        >
          contact page
        </Link>
        .
      </p>
    ),
  },
];

export default function PrivacyPolicyPage() {
  const lastUpdated = new Date().toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <main
      className="min-h-screen pt-24 pb-20 px-6 md:px-12"
      style={{ background: "var(--bg-primary)" }}
    >
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="text-xs tracking-widest uppercase transition-opacity hover:opacity-60 mb-8 inline-block"
          style={{ color: "var(--text-muted)" }}
        >
          ← Back to Aurora
        </Link>

        <h1
          className="text-3xl md:text-4xl font-bold mb-3"
          style={{ color: "var(--text-primary)" }}
        >
          Privacy Policy
        </h1>
        <p className="text-sm mb-12" style={{ color: "var(--text-muted)" }}>
          Last updated: {lastUpdated}
        </p>

        <div className="space-y-10" style={{ color: "var(--text-secondary)" }}>
          {SECTIONS.map((section) => (
            <section key={section.heading}>
              <h2
                className="text-lg font-semibold mb-4"
                style={{ color: "var(--accent)" }}
              >
                {section.heading}
              </h2>
              <div className="text-sm leading-relaxed">{section.body}</div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
