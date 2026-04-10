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
  const [categories, setCategories] = useState<Category[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const catRef = useRef<HTMLDivElement>(null);

  // Fetch categories immediately on mount so the dropdown is ready when opened
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      setCatLoading(false);
      return;
    }
    fetch(`${apiUrl}/api/categories`)
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
    <nav
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-12 py-2 border-b backdrop-blur-md"
      style={{
        background: "rgba(10, 10, 10, 0.92)",
        borderColor: "var(--border)",
      }}
    >
      <Logo size="sm" />

      {/* Centre: Categories dropdown + Trending */}
      <div className="hidden md:flex items-center gap-8">

        {/* Categories dropdown trigger + panel */}
        <div ref={catRef} className="relative">
          <button
            onClick={() => setCatOpen((v) => !v)}
            aria-expanded={catOpen}
            aria-label="Toggle categories menu"
            className="flex items-center gap-1.5 text-sm font-medium tracking-widest uppercase transition-colors duration-200 hover:text-white"
            style={{ color: catOpen ? "var(--accent)" : "var(--text-secondary)" }}
          >
            Categories
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{
                transition: "transform 0.2s ease",
                transform: catOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
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
              // Skeleton pills while fetching
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

        {/* Trending */}
        <Link
          href="/trending"
          className="text-sm font-medium tracking-widest uppercase transition-colors duration-200 hover:text-white"
          style={{ color: "var(--text-secondary)" }}
        >
          Trending
        </Link>
      </div>

      {/* Right: Search + Auth */}
      <div className="flex items-center gap-4">
        <div className="hidden md:block">
          <SearchBar />
        </div>
        <NavbarAuth />
      </div>
    </nav>
  );
};

export default Navbar;
