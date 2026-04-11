import Link from "next/link";
import { getWallpapers } from "@/lib/api";
import WallpaperCard from "@/app/components/WallpaperCard";
import { Wallpaper } from "@aura/types";
import type { Metadata } from "next";

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata({
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const { q } = await searchParams;
  return q
    ? { title: `"${q}" — Search | AURA`, description: `AURA wallpaper search results for "${q}".` }
    : { title: "Search | AURA", description: "Search for wallpapers on AURA." };
}

const SearchIcon = ({ size = 48 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ color: "var(--text-muted)" }}
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  let wallpapers: Wallpaper[] = [];
  if (query) {
    const res = await getWallpapers({ q: query, limit: 100 }).catch(() => ({
      data: [] as Wallpaper[],
      hasMore: false,
    }));
    wallpapers = res.data;
  }

  // ── No query state ────────────────────────────────────────
  if (!query) {
    return (
      <main
        className="min-h-screen pt-24 px-8 md:px-12"
        style={{ background: "var(--bg-primary)" }}
      >
        <div className="max-w-[1400px] mx-auto flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center text-center gap-4">
            <SearchIcon size={52} />
            <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
              Search AURA
            </h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Discover wallpapers by keyword, mood, or style
            </p>
          </div>
        </div>
      </main>
    );
  }

  // ── Query present ─────────────────────────────────────────
  return (
    <main
      className="min-h-screen pt-24 px-8 md:px-12"
      style={{ background: "var(--bg-primary)" }}
    >
      <div className="max-w-[1400px] mx-auto">

        {/* Header */}
        <div className="mb-8">
          <p
            className="text-xs tracking-widest uppercase mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            Search results for
          </p>
          <h1
            className="text-2xl font-bold mb-2"
            style={{ color: "var(--text-primary)" }}
          >
            {query}
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {wallpapers.length} wallpaper{wallpapers.length !== 1 ? "s" : ""} found
          </p>
        </div>

        {/* Empty state */}
        {wallpapers.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-24 rounded-2xl"
            style={{ border: "1px dashed var(--border)" }}
          >
            <SearchIcon size={40} />
            <p className="text-sm mt-5" style={{ color: "var(--text-secondary)" }}>
              No wallpapers found for &ldquo;{query}&rdquo;
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Try a different search term
            </p>
            <Link
              href="/"
              className="text-xs mt-5 transition-opacity hover:opacity-70"
              style={{ color: "var(--accent)" }}
            >
              Browse all wallpapers
            </Link>
          </div>
        ) : (
          /* Results grid */
          <div className="columns-2 sm:columns-3 md:columns-4 xl:columns-5 gap-4">
            {wallpapers.map((w: Wallpaper) => (
              <div key={w.id} className="break-inside-avoid mb-4">
                <WallpaperCard wallpaper={w} />
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
