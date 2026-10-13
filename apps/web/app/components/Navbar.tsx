"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/app/components/Logo";
import NavbarAuth from "@/app/components/NavbarAuth";
import SearchBar, { DeviceSwitch } from "@/app/components/SearchBar";
import type { Category } from "@/lib/api";
import { groupCategories, popularCategories, visibleCategories } from "@/lib/categoryGroups";

interface NavbarProps {
  /** Categories fetched by the root layout (server side). */
  initialCategories?: Category[];
}

const NAV_LINKS = [
  { href: "/latest", label: "Latest" },
  { href: "/trending", label: "Trending" },
] as const;

const Chevron = ({ open }: { open: boolean }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    className="transition-transform duration-200"
    style={{ transform: open ? "rotate(180deg)" : "none" }}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/** Small square thumbnail for a category; a lettered tile when it has none yet. */
function CategoryThumb({ category, className }: { category: Category; className: string }) {
  if (category.coverThumbUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={category.coverThumbUrl} alt="" loading="lazy" decoding="async" className={`${className} object-cover`} />;
  }
  return (
    <span className={`${className} flex items-center justify-center text-[11px] font-semibold`} style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }} aria-hidden>
      {category.name.slice(0, 1)}
    </span>
  );
}

const Navbar = ({ initialCategories = [] }: NavbarProps) => {
  const pathname = usePathname();
  const [exploreOpen, setExploreOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const exploreButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Hover opens the menu after a short pause and closes it shortly after the pointer leaves;
  // a click "pins" it open (it then closes on Escape, a click outside or the button again).
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinned = useRef(false);

  const clearHoverTimer = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  };
  const openExplore = (by: "hover" | "click") => {
    clearHoverTimer();
    pinned.current = by === "click";
    setExploreOpen(true);
  };
  const closeExplore = () => {
    clearHoverTimer();
    pinned.current = false;
    setExploreOpen(false);
  };
  const onHoverEnter = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    clearHoverTimer();
    if (!exploreOpen) hoverTimer.current = setTimeout(() => openExplore("hover"), 120);
  };
  const onHoverLeave = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || pinned.current) return;
    clearHoverTimer();
    hoverTimer.current = setTimeout(closeExplore, 220);
  };
  const onExploreClick = () => {
    if (exploreOpen && !pinned.current) pinned.current = true; // opened by hover → keep it open
    else if (exploreOpen) closeExplore();
    else openExplore("click");
  };
  useEffect(() => clearHoverTimer, []);

  const groups = useMemo(() => groupCategories(initialCategories), [initialCategories]);
  const popular = useMemo(() => popularCategories(initialCategories), [initialCategories]);
  const searchCategories = useMemo(() => visibleCategories(initialCategories), [initialCategories]);
  const visibleCount = searchCategories.length;

  // Close menus when the page changes.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setExploreOpen(false);
    setMobileOpen(false);
  }

  // Explore menu: close on Escape (focus back on the button) or a click outside.
  useEffect(() => {
    if (!exploreOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || exploreButtonRef.current?.contains(t)) return;
      setExploreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setExploreOpen(false);
        exploreButtonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [exploreOpen]);

  // "/" focuses search (unless the visitor is already typing somewhere).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (!searchRef.current || searchRef.current.offsetParent === null) return; // hidden (mobile)
      e.preventDefault();
      setExploreOpen(false);
      searchRef.current.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const exploreActive = exploreOpen || pathname.startsWith("/category") || pathname === "/categories";

  return (
    <>
      <nav
        className="fixed inset-x-0 top-0 z-50 flex h-16 items-center gap-4 border-b px-4 backdrop-blur-md sm:px-6 lg:gap-8 lg:px-12"
        style={{ background: "rgba(10, 10, 10, 0.92)", borderColor: "var(--border)" }}
        aria-label="Main"
      >
        <div className="flex shrink-0 items-center">
          <Logo height={24} className="hidden sm:flex" />
          <Logo height={30} variant="mark" className="flex sm:hidden" />
        </div>

        {/* Desktop links */}
        <div className="hidden h-full items-stretch md:flex">
          <button
            ref={exploreButtonRef}
            type="button"
            onClick={onExploreClick}
            onPointerEnter={onHoverEnter}
            onPointerLeave={onHoverLeave}
            aria-expanded={exploreOpen}
            aria-controls="explore-menu"
            className="relative flex items-center gap-1.5 px-3 text-sm font-medium transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]"
            style={{ color: exploreActive ? "#fff" : "var(--text-secondary)" }}
          >
            Explore
            <Chevron open={exploreOpen} />
            {exploreActive && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full" style={{ background: "var(--accent)" }} />}
          </button>
          {NAV_LINKS.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className="relative flex items-center px-3 text-sm font-medium transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]"
                style={{ color: active ? "#fff" : "var(--text-secondary)" }}
              >
                {l.label}
                {active && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full" style={{ background: "var(--accent)" }} />}
              </Link>
            );
          })}
        </div>

        <div className="ml-auto hidden min-w-0 max-w-[520px] flex-1 md:block">
          <SearchBar inputRef={searchRef} showShortcut categories={searchCategories} onSearch={() => setExploreOpen(false)} />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0">
          <NavbarAuth />
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-lg md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            style={{ color: "var(--text-primary)" }}
          >
            {mobileOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* Explore menu (desktop) */}
      {exploreOpen && (
        <div className="hidden md:block">
          <div className="fixed inset-0 top-16 z-30" style={{ background: "rgba(0,0,0,0.35)" }} aria-hidden />
          <div
            ref={panelRef}
            id="explore-menu"
            onPointerEnter={(e) => e.pointerType === "mouse" && clearHoverTimer()}
            onPointerLeave={onHoverLeave}
            className="fixed inset-x-0 top-16 z-40 max-h-[calc(100vh-64px)] overflow-y-auto border-b"
            style={{ background: "#0e0e0e", borderColor: "var(--border-hover)", boxShadow: "0 24px 48px rgba(0,0,0,0.5)", animation: "slideDown 0.18s ease forwards" }}
          >
            <div className="flex gap-10 px-6 pt-7 lg:px-12">
              <div className="flex min-w-0 flex-1 gap-8 xl:gap-12">
                {groups.map((g) => (
                  <div key={g.title} className="min-w-0 flex-1 xl:max-w-[220px]">
                    <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>
                      {g.title}
                    </p>
                    <ul className="flex flex-col gap-0.5">
                      {g.items.map((c) => (
                        <li key={c.id}>
                          <Link
                            href={`/category/${c.slug}`}
                            aria-current={pathname === `/category/${c.slug}` ? "page" : undefined}
                            className="-ml-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                            style={{ color: pathname === `/category/${c.slug}` ? "#fff" : "#d4d4d4" }}
                          >
                            <CategoryThumb category={c} className="h-7 w-7 shrink-0 rounded-md" />
                            <span className="truncate">{c.name}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {popular.length > 0 && (
                <div className="hidden w-[380px] shrink-0 lg:block xl:w-[460px]">
                  <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>
                    Popular categories
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {popular.map((c) => (
                      <Link
                        key={c.id}
                        href={`/category/${c.slug}`}
                        className="group relative block h-[118px] overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={c.coverThumbUrl!} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
                        <span className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.75))" }} />
                        <span className="absolute bottom-2.5 left-3 text-[15px] font-semibold text-white">{c.name}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex h-12 items-center border-t px-6 text-sm lg:px-12" style={{ borderColor: "var(--border)" }}>
              <Link href="/categories" className="font-medium transition-opacity hover:opacity-80" style={{ color: "var(--accent)" }}>
                Browse all {visibleCount} categories →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Mobile menu — the mobile layout gets its own redesign later */}
      {mobileOpen && (
        <div
          className="fixed inset-x-0 top-16 z-40 max-h-[calc(100vh-64px)] overflow-y-auto px-4 py-5 md:hidden"
          style={{ background: "rgba(10,10,10,0.97)", borderBottom: "1px solid var(--border)", backdropFilter: "blur(16px)" }}
        >
          <SearchBar onSearch={() => setMobileOpen(false)} showDevice={false} categories={searchCategories} />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Show wallpapers for</span>
            <DeviceSwitch showLabel />
          </div>

          <div className="mt-5 flex gap-2">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="flex-1 rounded-xl py-2.5 text-center text-sm font-medium"
                style={{ background: "var(--bg-elevated)", color: isActive(l.href) ? "#fff" : "var(--text-secondary)", border: "1px solid var(--border)" }}
              >
                {l.label}
              </Link>
            ))}
          </div>

          {groups.map((g) => (
            <div key={g.title} className="mt-5">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>
                {g.title}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {g.items.map((c) => (
                  <Link
                    key={c.id}
                    href={`/category/${c.slug}`}
                    className="flex items-center gap-2.5 rounded-xl p-1.5 pr-3 text-sm"
                    style={{ background: "var(--bg-elevated)", color: "#d4d4d4", border: "1px solid var(--border)" }}
                  >
                    <CategoryThumb category={c} className="h-8 w-8 shrink-0 rounded-lg" />
                    <span className="truncate">{c.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default Navbar;
