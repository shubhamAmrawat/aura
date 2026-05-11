import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | Aurora",
  description:
    "The rules and terms that govern your use of Aurora — including acceptable use, creator uploads, content licensing, and account responsibilities.",
};

const SECTIONS: Array<{ heading: string; body: React.ReactNode }> = [
  {
    heading: "1. Acceptance of Terms",
    body: (
      <p>
        By accessing or using Aurora at{" "}
        <a
          href="https://www.aurora-walls.com"
          className="underline-offset-2 hover:underline"
          style={{ color: "var(--accent)" }}
        >
          aurora-walls.com
        </a>{" "}
        (&quot;the Service&quot;), you agree to be bound by these Terms of
        Service and our Privacy Policy. If you do not agree with any part of
        these terms, please discontinue use of the Service.
      </p>
    ),
  },
  {
    heading: "2. Description of Service",
    body: (
      <p>
        Aurora is a wallpaper discovery, download, and curation platform.
        Through the Service, users can browse curated wallpapers, download
        them for personal use on supported devices, save favorites, follow
        creators, and (for verified creator accounts) upload their own work
        for distribution.
      </p>
    ),
  },
  {
    heading: "3. User Accounts",
    body: (
      <ul className="space-y-2 list-disc list-inside">
        <li>
          You must provide accurate, current, and complete information when
          creating an account.
        </li>
        <li>
          You are responsible for safeguarding your account credentials and for
          any activity that occurs under your account.
        </li>
        <li>
          One account per person. Creating multiple accounts to circumvent
          limits or bans is prohibited.
        </li>
        <li>
          You must be at least 13 years old (or the minimum age required in
          your jurisdiction) to use Aurora.
        </li>
      </ul>
    ),
  },
  {
    heading: "4. Acceptable Use",
    body: (
      <div className="space-y-4">
        <p>You agree to use Aurora only for lawful, personal purposes. You may not:</p>
        <ul className="space-y-2 list-disc list-inside">
          <li>
            Use automated tools, scrapers, or scripts to bulk-download
            wallpapers or scrape the gallery.
          </li>
          <li>
            Attempt to circumvent rate limits, download caps, or any technical
            measures used to protect the Service.
          </li>
          <li>
            Upload content you do not own or have explicit permission to
            distribute.
          </li>
          <li>
            Reverse engineer, decompile, or attempt to extract source code from
            the Service.
          </li>
          <li>
            Use the Service in any way that could damage, disable, or impair
            its operation.
          </li>
        </ul>
      </div>
    ),
  },
  {
    heading: "5. Creator Uploads",
    body: (
      <div className="space-y-4">
        <p>
          When you upload content as a creator on Aurora, you confirm that you
          own the work or have all necessary rights and permissions to
          distribute it. You retain ownership of your uploaded content.
        </p>
        <p>
          By uploading, you grant Aurora a non-exclusive, worldwide, royalty-free
          license to host, display, serve, optimize, and distribute your work
          through the Service. This license exists solely so we can run the
          platform — we do not claim ownership of your art.
        </p>
        <p>
          Aurora reserves the right to remove any uploaded content that
          violates these Terms, infringes on third-party rights, or fails to
          meet our curation standards.
        </p>
      </div>
    ),
  },
  {
    heading: "6. Intellectual Property",
    body: (
      <ul className="space-y-2 list-disc list-inside">
        <li>
          Aurora&apos;s design, branding, code, and platform are the property of
          Aurora and protected by copyright and trademark law.
        </li>
        <li>
          Rights to individual wallpapers belong to their respective creators,
          photographers, or licensors.
        </li>
        <li>
          Wallpapers sourced from Unsplash are governed by the Unsplash License.
        </li>
        <li>
          Use of any wallpaper outside of these Terms requires permission from
          the original rights holder.
        </li>
      </ul>
    ),
  },
  {
    heading: "7. Prohibited Content",
    body: (
      <div className="space-y-4">
        <p>The following content is strictly prohibited on Aurora:</p>
        <ul className="space-y-2 list-disc list-inside">
          <li>Illegal content of any kind.</li>
          <li>Adult, sexually explicit, or pornographic material.</li>
          <li>
            Content that promotes violence, hatred, discrimination, or
            harassment against any individual or group.
          </li>
          <li>
            Misleading, deceptive, or spam content — including misattributed
            artwork and AI-generated images posted as original photography.
          </li>
          <li>Content that infringes on intellectual property rights.</li>
        </ul>
      </div>
    ),
  },
  {
    heading: "8. Downloads & Personal Use",
    body: (
      <div className="space-y-4">
        <p>
          Wallpapers downloaded from Aurora are licensed for personal use on
          devices you own or control — phones, tablets, laptops, monitors.
        </p>
        <p>
          You may not redistribute, resell, sublicense, or use downloaded
          wallpapers in a commercial product without explicit written permission
          from the original creator. If you want to license a wallpaper for
          commercial use, contact us and we&apos;ll connect you with the artist.
        </p>
      </div>
    ),
  },
  {
    heading: "9. Disclaimer of Warranties",
    body: (
      <p>
        The Service is provided &quot;as is&quot; and &quot;as available&quot;
        without warranties of any kind, express or implied. Aurora does not
        guarantee that the Service will be uninterrupted, error-free, secure,
        or free from harmful components, and disclaims all warranties to the
        fullest extent permitted by law.
      </p>
    ),
  },
  {
    heading: "10. Limitation of Liability",
    body: (
      <p>
        To the maximum extent permitted by law, Aurora and its operators shall
        not be liable for any indirect, incidental, special, consequential, or
        punitive damages arising out of or in connection with your use of the
        Service. Our total liability for any claim is limited to the amount you
        paid us in the 12 months preceding the claim (which, for free users, is
        zero).
      </p>
    ),
  },
  {
    heading: "11. Termination",
    body: (
      <p>
        Aurora reserves the right to suspend, restrict, or terminate any
        account that violates these Terms, abuses the Service, infringes on
        third-party rights, or engages in fraudulent behavior. You may delete
        your account at any time from your profile settings.
      </p>
    ),
  },
  {
    heading: "12. Changes to Terms",
    body: (
      <p>
        We may modify these Terms at any time. When material changes are made,
        we&apos;ll update the &quot;Last updated&quot; date and notify
        registered users via email. Continued use of the Service after changes
        take effect constitutes acceptance of the revised Terms.
      </p>
    ),
  },
  {
    heading: "13. Contact",
    body: (
      <p>
        Questions about these Terms can be sent to{" "}
        <a
          href="mailto:amrawatshubham@gmail.com"
          className="underline-offset-2 hover:underline"
          style={{ color: "var(--accent)" }}
        >
          amrawatshubham@gmail.com
        </a>{" "}
        or through our{" "}
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

export default function TermsOfServicePage() {
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
          Terms of Service
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
