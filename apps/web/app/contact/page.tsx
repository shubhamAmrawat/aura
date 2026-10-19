import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Palette, Scale, Shield } from "lucide-react";

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
  <Mail size={20} strokeWidth={1.8} aria-hidden />
);

const PaletteIcon = (
  <Palette size={20} strokeWidth={1.8} aria-hidden />
);

const ShieldIcon = (
  <Shield size={20} strokeWidth={1.8} aria-hidden />
);

const ScaleIcon = (
  <Scale size={20} strokeWidth={1.8} aria-hidden />
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
