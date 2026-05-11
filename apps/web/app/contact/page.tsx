import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact | Aurora",
  description:
    "Get in touch with the Aurora team — general inquiries, creator partnerships, privacy questions, and DMCA notices.",
};

type ContactCard = {
  label: string;
  email: string;
  description: string;
  icon: React.ReactNode;
};

const MailIcon = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const PaletteIcon = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <circle cx="13.5" cy="6.5" r="1.5" />
    <circle cx="17.5" cy="10.5" r="1.5" />
    <circle cx="8.5" cy="7.5" r="1.5" />
    <circle cx="6.5" cy="12.5" r="1.5" />
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
  </svg>
);

const ShieldIcon = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const ScaleIcon = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M12 3v18" />
    <path d="M5 21h14" />
    <path d="M5 7l-3 7h6l-3-7z" />
    <path d="M19 7l-3 7h6l-3-7z" />
    <path d="M5 7h14" />
  </svg>
);

const CARDS: ContactCard[] = [
  {
    label: "General Inquiries",
    email: "amrawatshubham@gmail.com",
    description:
      "Questions, feedback, press, or just want to say hi — start here.",
    icon: MailIcon,
  },
  {
    label: "Creator Partnerships",
    email: "amrawatshubham@gmail.com",
    description:
      "For artists and photographers interested in collaborating, commissions, or featured drops.",
    icon: PaletteIcon,
  },
  {
    label: "Privacy & Data",
    email: "amrawatshubham@gmail.com",
    description:
      "Data access requests, deletion, or anything privacy-policy related.",
    icon: ShieldIcon,
  },
  {
    label: "DMCA & Copyright",
    email: "amrawatshubham@gmail.com",
    description:
      "Copyright concerns, takedown requests, and counter-notices.",
    icon: ScaleIcon,
  },
];

export default function ContactPage() {
  return (
    <main
      className="min-h-screen pt-24 pb-20 px-6 md:px-12"
      style={{ background: "var(--bg-primary)" }}
    >
      <div className="max-w-2xl mx-auto">
        <Link
          href="/"
          className="text-xs tracking-widest uppercase transition-opacity hover:opacity-60 mb-10 inline-block"
          style={{ color: "var(--text-muted)" }}
        >
          ← Back to Aurora
        </Link>

        <section className="mb-12">
          <p
            className="text-[11px] tracking-[0.3em] uppercase mb-4"
            style={{ color: "var(--accent)" }}
          >
            Contact
          </p>
          <h1
            className="text-3xl md:text-4xl font-bold mb-5"
            style={{ color: "var(--text-primary)" }}
          >
            Get in Touch
          </h1>
          <p
            className="text-base leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            Whether you&apos;re a creator, have a question, or found something
            broken — we&apos;d love to hear from you.
          </p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {CARDS.map((card) => (
            <a
              key={card.label}
              href={`mailto:${card.email}`}
              className="rounded-xl p-6 transition-colors group block"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
              }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                style={{
                  background: "var(--accent-muted)",
                  color: "var(--accent)",
                }}
              >
                {card.icon}
              </div>
              <p
                className="text-xs tracking-[0.15em] uppercase mb-2"
                style={{ color: "var(--text-muted)" }}
              >
                {card.label}
              </p>
              <p
                className="text-sm font-medium mb-3 break-all"
                style={{ color: "var(--accent)" }}
              >
                {card.email}
              </p>
              <p
                className="text-xs leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                {card.description}
              </p>
            </a>
          ))}
        </section>

        <section
          className="rounded-xl p-5"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            <span
              className="font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              Response time:
            </span>{" "}
            We typically respond within 24–48 hours. For urgent copyright
            matters, use the DMCA email above for the fastest response.
          </p>
        </section>
      </div>
    </main>
  );
}
