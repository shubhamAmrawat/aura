"use client";

import { useState } from "react";
import { Wallpaper } from "@aura/types";
import WallpaperCard from "@/app/components/WallpaperCard";
import { getTrendingWallpapers } from "@/lib/api";

const PAGE_SIZE = 20;

interface TrendingGridProps {
  initialWallpapers: Wallpaper[];
  initialHasMore: boolean;
}

export default function TrendingGrid({
  initialWallpapers,
  initialHasMore,
}: TrendingGridProps) {
  const [wallpapers, setWallpapers] = useState<Wallpaper[]>(initialWallpapers);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);

  const loadMore = async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const result = await getTrendingWallpapers({
        limit: PAGE_SIZE,
        offset: wallpapers.length,
      });
      setWallpapers((prev) => {
        const seen = new Set(prev.map((w) => w.id));
        return [...prev, ...result.data.filter((w) => !seen.has(w.id))];
      });
      setHasMore(result.hasMore);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  if (wallpapers.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-24 rounded-2xl"
        style={{ border: "1px dashed var(--border)" }}
      >
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No trending wallpapers yet
        </p>
      </div>
    );
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
              "Load more"
            )}
          </button>
        </div>
      )}

      {!hasMore && wallpapers.length > 0 && (
        <p
          className="mt-12 text-center text-xs tracking-widest uppercase"
          style={{ color: "var(--text-muted)" }}
        >
          You&apos;ve seen all trending wallpapers
        </p>
      )}
    </>
  );
}