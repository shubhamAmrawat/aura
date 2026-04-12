import Link from "next/link";
import { semanticSearch } from "@/lib/api";
import type { Metadata } from "next";
import { SearchGrid } from "@/app/search/SearchGrid";
import { mapSearchResult } from "@/app/search/mapSearchResult";

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
  const params = await searchParams;
  const q = (params.q ?? "").trim();

  const [searchResult] = await Promise.allSettled([
    q.length >= 2
      ? semanticSearch({ q, limit: 20, mode: "hybrid" })
      : Promise.resolve({ data: [], hasMore: false, mode: "none" as const }),
  ]);

  const initialResultsRaw =
    searchResult.status === "fulfilled" ? searchResult.value.data : [];
  const initialHasMore =
    searchResult.status === "fulfilled" ? searchResult.value.hasMore : false;
  const searchMode =
    searchResult.status === "fulfilled" ? searchResult.value.mode : "none";

  const initialResults = initialResultsRaw.map((row) =>
    mapSearchResult(row as Record<string, unknown>)
  );

  // ── No query state ────────────────────────────────────────
  if (!q) {
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
            <p
              className="text-xs italic mt-1 max-w-sm"
              style={{ color: "var(--text-muted)" }}
            >
              Try mood searches like &ldquo;feels like 3am Tokyo&rdquo; or &ldquo;peaceful mountain
              morning&rdquo;
            </p>
          </div>
        </div>
      </main>
    );
  }

  const hasResults = initialResults.length > 0;
  // const modeBadge =
  //   searchMode !== "none" ? (
  //     <span
  //       className="text-[10px] px-2 py-0.5 rounded-full ml-2 align-middle inline-block"
  //       style={{
  //         background: "rgba(64,192,87,0.1)",
  //         color: "var(--accent)",
  //         border: "1px solid rgba(64,192,87,0.2)",
  //       }}
  //     >
  //       {searchMode === "semantic"
  //         ? "semantic"
  //         : searchMode === "hybrid"
  //           ? "AI-powered"
  //           : "keyword"}{" "}
  //       search
  //     </span>
  //   ) : null;

  // ── Query present ─────────────────────────────────────────
  return (
    <main
      className="min-h-screen pt-24 px-8 md:px-12"
      style={{ background: "var(--bg-primary)" }}
    >
      <div className="max-w-[1400px] mx-auto">
        <div className="mb-8">
          <h1
            className="text-2xl font-bold mb-2 flex flex-wrap items-baseline gap-x-2"
            style={{ color: "var(--text-primary)" }}
          >
            <span>Results for &ldquo;{q}&rdquo;</span>
            {/* {modeBadge} */}
          </h1>
          <p className="text-xs italic mt-1" style={{ color: "var(--text-muted)" }}>
            Try mood searches like &ldquo;feels like 3am Tokyo&rdquo; or &ldquo;peaceful mountain
            morning&rdquo;
          </p>
          {/* <p className="text-sm mt-3" style={{ color: "var(--text-muted)" }}>
            {q.length < 2
              ? "Enter at least 2 characters to search."
              : `${initialResults.length} wallpaper${initialResults.length !== 1 ? "s" : ""} found`}
          </p> */}
        </div>

        {!hasResults ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No results for &ldquo;{q}&rdquo;
            </p>
            {q.length < 2 ? (
              <p
                className="text-xs text-center max-w-xs"
                style={{ color: "var(--text-muted)", opacity: 0.7 }}
              >
                Type at least 2 characters to run semantic search.
              </p>
            ) : (
              <p
                className="text-xs text-center max-w-xs"
                style={{ color: "var(--text-muted)", opacity: 0.7 }}
              >
                Try a mood description like &ldquo;cozy rainy evening&rdquo; or &ldquo;vibrant summer
                energy&rdquo;
              </p>
            )}
            <Link
              href="/"
              className="text-xs mt-2 transition-opacity hover:opacity-70"
              style={{ color: "var(--accent)" }}
            >
              Browse all wallpapers →
            </Link>
          </div>
        ) : (
          <SearchGrid
            key={q}
            initialResults={initialResults}
            initialHasMore={initialHasMore}
            q={q}
            mode={searchMode}
          />
        )}
      </div>
    </main>
  );
}
