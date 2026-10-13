import Link from "next/link";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--bg-primary)" }}>
      <div className="text-center max-w-sm">
        <p className="text-xs tracking-widest uppercase mb-3" style={{ color: "var(--text-muted)" }}>404</p>
        <h1 className="text-2xl font-semibold mb-3" style={{ color: "var(--text-primary)" }}>This page isn&apos;t here</h1>
        <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
          The wallpaper or page may have been removed, or the link is wrong.
        </p>
        <div className="flex justify-center gap-3">
          <Link href="/" className="text-sm font-semibold px-4 py-2 rounded-lg" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>
            Go home
          </Link>
          <Link href="/categories" className="text-sm px-4 py-2 rounded-lg hover:bg-white/5" style={{ border: "1px solid var(--border-hover)", color: "var(--text-primary)" }}>
            Browse categories
          </Link>
        </div>
      </div>
    </main>
  );
}
