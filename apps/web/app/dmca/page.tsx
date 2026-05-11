import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "DMCA Copyright Policy | Aurora",
  description:
    "Aurora's DMCA copyright takedown policy, counter-notice procedure, and contact information for rights holders.",
};

const SECTIONS: Array<{ heading: string; body: React.ReactNode }> = [
  {
    heading: "1. Overview",
    body: (
      <p>
        Aurora respects the intellectual property rights of artists,
        photographers, and rights holders. We comply with the Digital
        Millennium Copyright Act (DMCA) and respond promptly to valid
        takedown notices. If you believe content hosted on Aurora infringes
        your copyright, the steps below explain how to report it.
      </p>
    ),
  },
  {
    heading: "2. Reporting Copyright Infringement",
    body: (
      <div className="space-y-4">
        <p>
          To submit a DMCA takedown notice, email{" "}
          <a
            href="mailto:amrawatshubham@gmail.com"
            className="underline-offset-2 hover:underline"
            style={{ color: "var(--accent)" }}
          >
            amrawatshubham@gmail.com
          </a>{" "}
          with a written notice that includes <strong>all</strong> of the
          following:
        </p>
        <ul className="space-y-2 list-disc list-inside">
          <li>Your full legal name and contact information (email, phone, address).</li>
          <li>
            A clear description of the copyrighted work you claim has been
            infringed.
          </li>
          <li>
            The exact URL(s) of the allegedly infringing content on Aurora.
          </li>
          <li>
            A statement that you have a good-faith belief that the use of the
            material is not authorized by the copyright owner, its agent, or
            the law.
          </li>
          <li>
            A statement, made under penalty of perjury, that the information in
            your notice is accurate and that you are the copyright owner or
            authorized to act on behalf of the owner.
          </li>
          <li>
            Your physical or electronic signature.
          </li>
        </ul>
        <p>
          Incomplete notices may not be actionable. We recommend providing as
          much supporting context as possible (proof of ownership, original
          file dates, portfolio links) to speed up review.
        </p>
      </div>
    ),
  },
  {
    heading: "3. Counter-Notice",
    body: (
      <div className="space-y-4">
        <p>
          If your content was removed from Aurora and you believe the takedown
          was in error or misidentification, you may file a counter-notice by
          emailing the same address with the following information:
        </p>
        <ul className="space-y-2 list-disc list-inside">
          <li>Your full name, address, phone number, and email.</li>
          <li>
            Identification of the content that was removed and the location it
            appeared on Aurora before removal.
          </li>
          <li>
            A statement, under penalty of perjury, that you have a good-faith
            belief the content was removed as a result of mistake or
            misidentification.
          </li>
          <li>
            A statement that you consent to the jurisdiction of the federal
            court in your district (or, if outside the U.S., any judicial
            district in which Aurora may be found).
          </li>
          <li>A statement that you will accept service of process from the original complainant.</li>
          <li>Your physical or electronic signature.</li>
        </ul>
        <p>
          Once a valid counter-notice is received, we may restore the removed
          content within 10–14 business days unless the original complainant
          files a court action seeking to restrain the use.
        </p>
      </div>
    ),
  },
  {
    heading: "4. Repeat Infringers",
    body: (
      <p>
        Aurora maintains a policy of terminating, in appropriate
        circumstances, the accounts of users who are determined to be repeat
        copyright infringers. This includes uploaders who have multiple
        confirmed takedown notices filed against their content.
      </p>
    ),
  },
  {
    heading: "5. Response Time",
    body: (
      <p>
        We aim to acknowledge valid DMCA notices within 24 hours and process
        them within 48–72 hours. Complex cases involving disputed ownership or
        multiple parties may take longer. You&apos;ll receive an email
        confirmation once your notice has been reviewed and acted upon.
      </p>
    ),
  },
  {
    heading: "6. Contact",
    body: (
      <p>
        Send all DMCA correspondence to{" "}
        <a
          href="mailto:amrawatshubham@gmail.com"
          className="underline-offset-2 hover:underline"
          style={{ color: "var(--accent)" }}
        >
          amrawatshubham@gmail.com
        </a>
        . For non-DMCA copyright questions or licensing inquiries, see our{" "}
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

export default function DmcaPage() {
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
          DMCA Copyright Policy
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
