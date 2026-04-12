"use client";

import { useState } from "react";
import type { Wallpaper } from "@aura/types";
import WallpaperCard from "@/app/components/WallpaperCard";
import { semanticSearch } from "@/lib/api";
import { mapSearchResult } from "@/app/search/mapSearchResult";

const PAGE_SIZE = 20;

function toRequestMode(mode: string): "semantic" | "keyword" | "hybrid" {
  if (mode === "semantic" || mode === "keyword" || mode === "hybrid") return mode;
  return "hybrid";
}

interface SearchGridProps {
  initialResults: Wallpaper[];
  initialHasMore: boolean;
  q: string;
  mode: string;
}

export function SearchGrid({
  initialResults,
  initialHasMore,
  q,
  mode,
}: SearchGridProps) {
  const [wallpapers, setWallpapers] = useState<Wallpaper[]>(initialResults);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);

  const requestMode = toRequestMode(mode);

  const loadMore = async () => {
    if (loading || !hasMore || q.length < 2) return;
    setLoading(true);
    try {
      const result = await semanticSearch({
        q,
        limit: PAGE_SIZE,
        offset: wallpapers.length,
        mode: requestMode,
      });
      const mapped = result.data.map((row) =>
        mapSearchResult(row as Record<string, unknown>)
      );
      setWallpapers((prev) => {
        const seen = new Set(prev.map((w) => w.id));
        const fresh = mapped.filter((w) => !seen.has(w.id));
        return [...prev, ...fresh];
      });
      setHasMore(result.hasMore);
    } catch {
      // keep button; user can retry
    } finally {
      setLoading(false);
    }
  };

  if (wallpapers.length === 0) {
    return null;
  }

  return (
    <>
      <div className="columns-2 sm:columns-3 md:columns-4 xl:columns-5 gap-4">
        {wallpapers.map((wallpaper, index) => (
          <div key={wallpaper.id} className="break-inside-avoid mb-4">
            <WallpaperCard wallpaper={wallpaper} priority={index === 0} />
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center mt-12">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="flex items-center gap-3 px-8 py-3 rounded-full text-sm font-medium transition-all hover:opacity-80 disabled:opacity-40"
            style={{
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
              background: "var(--bg-elevated)",
            }}
          >
            {loading ? (
              <>
                <div
                  className="w-4 h-4 rounded-full border-2 animate-spin"
                  style={{
                    borderColor: "var(--border)",
                    borderTopColor: "var(--accent)",
                  }}
                />
                Loading...
              </>
            ) : (
              "Load more wallpapers"
            )}
          </button>
        </div>
      )}

      {!hasMore && wallpapers.length > 0 && (
        <p
          className="mt-12 text-center text-xs tracking-widest uppercase"
          style={{ color: "var(--text-muted)" }}
        >
          All {wallpapers.length} wallpapers loaded
        </p>
      )}
    </>
  );
}
