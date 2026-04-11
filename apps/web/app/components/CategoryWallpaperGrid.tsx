"use client";

import Link from "next/link";
import { useState } from "react";
import { Wallpaper } from "@aura/types";
import WallpaperCard from "@/app/components/WallpaperCard";
import { getWallpapers } from "@/lib/api";

const PAGE_SIZE = 20;

interface CategoryWallpaperGridProps {
  slug: string;
  initialWallpapers: Wallpaper[];
  initialHasMore: boolean;
}

export function CategoryWallpaperGrid({
  slug,
  initialWallpapers,
  initialHasMore,
}: CategoryWallpaperGridProps) {
  const [wallpapers, setWallpapers] = useState<Wallpaper[]>(initialWallpapers);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);

  const loadMore = async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const result = await getWallpapers({
        category: slug,
        limit: PAGE_SIZE,
        offset: wallpapers.length,
      });
      setWallpapers((prev) => {
        const seen = new Set(prev.map((w) => w.id));
        const fresh = result.data.filter((w) => !seen.has(w.id));
        return [...prev, ...fresh];
      });
      setHasMore(result.hasMore);
    } catch {
      // silently fail — button stays visible, user can retry
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
        <p className="text-sm mb-1" style={{ color: "var(--text-muted)" }}>
          No wallpapers in this category yet
        </p>
        <Link
          href="/"
          className="text-xs mt-2 transition-opacity hover:opacity-70"
          style={{ color: "var(--accent)" }}
        >
          Browse all wallpapers →
        </Link>
      </div>
    );
  }

  return (
    <>
      <p className="text-xs mb-6" style={{ color: "var(--text-muted)" }}>
        {wallpapers.length} wallpaper{wallpapers.length !== 1 ? "s" : ""} loaded
        {hasMore ? " — more available" : ""}
      </p>

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
