import Link from "next/link";
import Logo from "@/app/components/Logo";

const footerLinkClass =
  "text-[10px] tracking-[0.1em] uppercase transition-colors duration-200 text-[var(--text-secondary)] hover:text-[var(--text-primary)]";

export default function Footer() {
  return (
    <footer
      className="border-t px-8 py-2 md:px-12 md:py-2"
      style={{
        borderColor: "var(--border)",
        background: "var(--bg-primary)",
      }}
    >
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex items-center gap-2">
          <Logo href="/" size={28} priority unoptimized />
          <span
            className="text-[10px] tracking-[0.1em] uppercase"
            style={{ color: "var(--text-muted)" }}
          >
            Visual Culture
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 sm:gap-x-6">
          <nav
            className="flex items-center gap-4 sm:gap-5"
            aria-label="Footer"
          >
            <Link href="/" className={footerLinkClass}>
              Home
            </Link>
            <Link href="/privacy" className={footerLinkClass}>
              Privacy
            </Link>
          </nav>
          <span
            className="hidden h-3 w-px sm:block"
            style={{ background: "var(--border)" }}
            aria-hidden
          />
          <p
            className="text-[10px] tracking-[0.04em] whitespace-nowrap"
            style={{ color: "var(--text-muted)" }}
          >
            © {new Date().getFullYear()} Aurora
          </p>
        </div>
      </div>
    </footer>
  );
}
