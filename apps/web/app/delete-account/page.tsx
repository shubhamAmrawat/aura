import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Delete your account | Aurora",
  description: "How to delete your Aurora account and what happens to your data — from the Aurora app, the website, or by email.",
  alternates: { canonical: "/delete-account" },
};

const EMAIL = "amrawatshubham@gmail.com";

const linkStyle = { color: "var(--accent)" } as const;
const linkClass = "underline-offset-2 hover:underline";

const SECTIONS: Array<{ heading: string; body: React.ReactNode }> = [
  {
    heading: "In the Aurora app",
    body: (
      <ol className="space-y-2 list-decimal list-inside">
        <li>Open Aurora and sign in.</li>
        <li>Tap your profile picture at the top right, then open Settings.</li>
        <li>Tap Delete account and confirm with the code we email you (and your password, if your account has one).</li>
      </ol>
    ),
  },
  {
    heading: "On the website",
    body: (
      <p>
        Sign in at aurora-walls.com, open{" "}
        <Link href="/settings#delete" className={linkClass} style={linkStyle}>
          Settings
        </Link>{" "}
        and choose Delete account under Danger zone. You confirm it the same way as in the app.
      </p>
    ),
  },
  {
    heading: "Can't sign in?",
    body: (
      <p>
        Email{" "}
        <a href={`mailto:${EMAIL}?subject=Delete%20my%20Aurora%20account`} className={linkClass} style={linkStyle}>
          {EMAIL}
        </a>{" "}
        from the email address on your account with the subject “Delete my Aurora account”. We check that the request
        comes from the account owner and delete the account within 30 days.
      </p>
    ),
  },
  {
    heading: "What is deleted",
    body: (
      <ul className="space-y-2 list-disc list-inside">
        <li>Your account: email, username, display name, bio, password and sign-in links (Google).</li>
        <li>Your profile photo and cover image.</li>
        <li>Your likes, collections and the creators you blocked.</li>
        <li>Wallpapers you uploaded as a creator, including the image files.</li>
      </ul>
    ),
  },
  {
    heading: "What is kept",
    body: (
      <ul className="space-y-2 list-disc list-inside">
        <li>Download and view counts, without any link to you.</li>
        <li>Reports you sent about content, without your name, so our moderation records stay complete.</li>
        <li>App crash reports, which carry only an anonymous account id (no name or email) and are removed automatically within 90 days.</li>
      </ul>
    ),
  },
  {
    heading: "When it happens",
    body: (
      <p>
        Deleting from the app or the website is immediate and can&apos;t be undone. Signing in again afterwards creates a
        new, empty account. See our{" "}
        <Link href="/privacy-policy" className={linkClass} style={linkStyle}>
          Privacy Policy
        </Link>{" "}
        for more on how we handle data.
      </p>
    ),
  },
];

/** Public page for Google Play's "account deletion URL": works without signing in or installing the app. */
export default function DeleteAccountPage() {
  return (
    <main className="min-h-screen pt-24 pb-20 px-6 md:px-12" style={{ background: "var(--bg-primary)" }}>
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="text-xs tracking-widest uppercase transition-opacity hover:opacity-60 mb-8 inline-block"
          style={{ color: "var(--text-muted)" }}
        >
          ← Back to Aurora
        </Link>

        <h1 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>
          Delete your Aurora account
        </h1>
        <p className="text-sm mb-12" style={{ color: "var(--text-secondary)" }}>
          You can delete your account and its data at any time, from the app, the website, or by email.
        </p>

        <div className="space-y-10" style={{ color: "var(--text-secondary)" }}>
          {SECTIONS.map((section) => (
            <section key={section.heading}>
              <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--accent)" }}>
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
