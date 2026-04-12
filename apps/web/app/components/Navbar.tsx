"use client";

import { useState, useEffect, useRef } from "react";
import Logo from "@/app/components/Logo";
import Link from "next/link";
import NavbarAuth from "@/app/components/NavbarAuth";
import SearchBar from "@/app/components/SearchBar";

interface Category {
  id: string;
  name: string;
  slug: string;
}

/** Shared stroke icon shell — matches NavbarAuth / existing nav SVG style */
const navIconSvgProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const IconLayoutGrid = () => (
  <svg {...navIconSvgProps} aria-hidden>
    <rect width="7" height="7" x="3" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="14" rx="1" />
    <rect width="7" height="7" x="3" y="14" rx="1" />
  </svg>
);

const IconClock = () => (
  <svg {...navIconSvgProps} aria-hidden>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const IconTrendingUp = () => (
  <svg {...navIconSvgProps} aria-hidden>
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </svg>
);

const navIconBtnClass =
  "flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(10,10,10,0.92)]";

// Extracted pill so hover state is tracked per item without inline handlers
const CategoryPill = ({
  cat,
  onClose,
}: {
  cat: Category;
  onClose: () => void;
}) => {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href={`/category/${cat.slug}`}
      onClick={onClose}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="text-xs px-4 py-2 rounded-full text-center border transition-all duration-150"
      style={{
        background: hovered ? "var(--accent)" : "transparent",
        color: hovered ? "var(--bg-primary)" : "var(--text-secondary)",
        borderColor: hovered ? "var(--accent)" : "var(--border)",
      }}
    >
      {cat.name}
    </Link>
  );
};

const Navbar = () => {
  const [catOpen, setCatOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [catLoading, setCatLoading] = useState(() =>
    Boolean(process.env.NEXT_PUBLIC_API_URL),
  );
  const catRef = useRef<HTMLDivElement>(null);

  // Fetch categories immediately on mount so the dropdown is ready when opened
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return;
    fetch(`${apiUrl}/api/categories`, { credentials: "include" })
      .then((r) => r.json())
      .then((json) => setCategories(json.data ?? []))
      .catch(() => {})
      .finally(() => setCatLoading(false));
  }, []);

  // Close dropdown when clicking outside the trigger + panel
  useEffect(() => {
    if (!catOpen) return;
    const handler = (e: MouseEvent) => {
      if (catRef.current && !catRef.current.contains(e.target as Node)) {
        setCatOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [catOpen]);

  return (
  <>
    <nav
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-12 py-2 border-b backdrop-blur-md"
      style={{
        background: "rgba(10, 10, 10, 0.92)",
        borderColor: "var(--border)",
      }}
    >
      <Logo size="sm" />

      {/* True viewport center — absolute so uneven left/right widths don't pull the cluster left */}
      <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 hidden -translate-x-1/2 md:flex md:items-center">
        <div className="pointer-events-auto flex items-center gap-1">

        {/* Categories dropdown trigger + panel */}
        <div ref={catRef} className="relative">
          <button
            type="button"
            onClick={() => setCatOpen((v) => !v)}
            aria-expanded={catOpen}
            aria-label="Categories"
            title="Categories"
            className={`${navIconBtnClass} gap-0.5 px-1.5 w-auto min-w-10 hover:text-white ${
              catOpen ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"
            }`}
          >
            <IconLayoutGrid />
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-70 shrink-0"
              style={{
                transition: "transform 0.2s ease",
                transform: catOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
              aria-hidden
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {/* Dropdown panel — absolute, anchored to the button */}
          <div
            className="absolute top-full mt-4 w-[560px] max-w-[90vw] rounded-2xl p-5"
            style={{
              left: "50%",
              background: "rgba(16,16,16,0.97)",
              border: "1px solid var(--border)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
              backdropFilter: "blur(24px)",
              opacity: catOpen ? 1 : 0,
              transform: catOpen
                ? "translateX(-50%) translateY(0)"
                : "translateX(-50%) translateY(-8px)",
              transition: "opacity 0.18s ease, transform 0.18s ease",
              pointerEvents: catOpen ? "auto" : "none",
              zIndex: 50,
            }}
          >
            {catLoading ? (
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-8 rounded-full animate-pulse"
                    style={{ background: "var(--bg-elevated)" }}
                  />
                ))}
              </div>
            ) : categories.length === 0 ? (
              <p
                className="text-xs text-center py-3"
                style={{ color: "var(--text-muted)" }}
              >
                No categories available.
              </p>
            ) : (
              <div className="grid grid-cols-3 lg:grid-cols-4 gap-2">
                {categories.map((cat) => (
                  <CategoryPill
                    key={cat.id}
                    cat={cat}
                    onClose={() => setCatOpen(false)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <Link
          href="/latest"
          aria-label="Latest wallpapers"
          title="Latest"
          className={`${navIconBtnClass} text-[var(--text-secondary)]`}
        >
          <IconClock />
        </Link>
        <Link
          href="/trending"
          aria-label="Trending wallpapers"
          title="Trending"
          className={`${navIconBtnClass} text-[var(--text-secondary)]`}
        >
          <IconTrendingUp />
        </Link>
        </div>
      </div>

      {/* Right: Search + Auth + Hamburger */}
      <div className="flex items-center gap-3">
        <div className="hidden md:block">
          <SearchBar />
        </div>
        <NavbarAuth />
        {/* hamburger — mobile only */}
        <button
          className="md:hidden flex p-1"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-primary)" }}>
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-primary)" }}>
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </div>
    </nav>

    {/* Mobile drawer — shown below navbar when hamburger is open */}
    {mobileOpen && (
      <div
        className="fixed left-0 right-0 z-40 md:hidden px-6 py-5"
        style={{
          top: "57px",
          background: "rgba(10,10,10,0.97)",
          borderBottom: "1px solid var(--border)",
          backdropFilter: "blur(16px)",
        }}
      >
        {/* search */}
        <div className="mb-4">
          <SearchBar />
        </div>

        {/* categories */}
        <p className="text-[10px] tracking-widest uppercase mb-2" style={{ color: "var(--text-muted)" }}>
          Categories
        </p>
        {catLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-8 rounded-full animate-pulse" style={{ background: "var(--bg-elevated)" }} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {categories.map((cat) => (
              <CategoryPill
                key={cat.id}
                cat={cat}
                onClose={() => setMobileOpen(false)}
              />
            ))}
          </div>
        )}

        {/* divider */}
        <div className="my-4" style={{ borderTop: "1px solid var(--border)" }} />

        <div className="flex items-center gap-2">
          <Link
            href="/latest"
            onClick={() => setMobileOpen(false)}
            aria-label="Latest wallpapers"
            title="Latest"
            className={`${navIconBtnClass} text-[var(--text-secondary)]`}
          >
            <IconClock />
          </Link>
          <Link
            href="/trending"
            onClick={() => setMobileOpen(false)}
            aria-label="Trending wallpapers"
            title="Trending"
            className={`${navIconBtnClass} text-[var(--text-secondary)]`}
          >
            <IconTrendingUp />
          </Link>
        </div>
      </div>
    )}
  </>
  );
};

export default Navbar;
