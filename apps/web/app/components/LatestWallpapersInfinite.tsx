"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Wallpaper } from "@aura/types";
import WallpaperCard from "./WallpaperCard";
import WallpaperCardSkeleton from "./WallpaperCardSkeleton";
import { getWallpapersPage, WALLPAPERS_FEED_PAGE_SIZE } from "@/lib/api";
const SKELETON_COUNT = 16;
/** Load the next page before the user hits the bottom to keep scrolling continuous. */
const ROOT_MARGIN = "400px 0px";

interface LatestWallpapersInfiniteProps {
  initialWallpapers: Wallpaper[];
  initialHasMore: boolean;
}

export default function LatestWallpapersInfinite({
  initialWallpapers,
  initialHasMore,
}: LatestWallpapersInfiniteProps) {
  const [items, setItems] = useState<Wallpaper[]>(initialWallpapers);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(initialHasMore);
  const nextOffsetRef = useRef(initialWallpapers.length);

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);
    setLoadError(null);

    const offset = nextOffsetRef.current;

    try {
      const { data, hasMore: more } = await getWallpapersPage({
        offset,
        limit: WALLPAPERS_FEED_PAGE_SIZE,
      });

      nextOffsetRef.current = offset + data.length;
      const effectiveHasMore = more && data.length > 0;
      hasMoreRef.current = effectiveHasMore;
      setHasMore(effectiveHasMore);

      setItems((prev) => {
        if (data.length === 0) return prev;
        const seen = new Set(prev.map((w) => w.id));
        const appended: Wallpaper[] = [];
        for (const w of data) {
          if (!seen.has(w.id)) {
            seen.add(w.id);
            appended.push(w);
          }
        }
        return appended.length === 0 ? prev : [...prev, ...appended];
      });
    } catch {
      setLoadError("Couldn’t load more wallpapers. Check your connection and try again.");
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (observerEntries) => {
        const entry = observerEntries[0];
        if (!entry?.isIntersecting) return;
        if (!hasMoreRef.current || loadingRef.current) return;
        void loadMore();
      },
      { root: null, rootMargin: ROOT_MARGIN, threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const subtitle =
    items.length === 0 && !isLoading
      ? "Browse the gallery"
      : `${items.length} wallpaper${items.length !== 1 ? "s" : ""} loaded${
          hasMore ? " — scroll for more" : ""
        }`;

  const showEmptyState = items.length === 0 && !isLoading;

  return (
    <>
      <div className="mb-8">
        <h2
          className="text-base font-semibold tracking-[0.15em] uppercase"
          style={{ color: "var(--text-primary)" }}
        >
          Latest Wallpapers
        </h2>
        <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
          {subtitle}
        </p>
      </div>

      {showEmptyState ? (
        <div className="py-20 text-center">
          <p style={{ color: "var(--text-secondary)" }}>No wallpapers found</p>
        </div>
      ) : (
        <div className="columns-2 sm:columns-3 md:columns-4 xl:columns-5 gap-4">
          {items.map((wallpaper) => (
            <div key={wallpaper.id} className="break-inside-avoid mb-4">
              <WallpaperCard wallpaper={wallpaper} />
            </div>
          ))}
          {isLoading
            ? Array.from({ length: SKELETON_COUNT }, (_, i) => (
                <WallpaperCardSkeleton key={`loading-${i}`} index={i} />
              ))
            : null}
        </div>
      )}

      {/* Invisible sentinel — keeps layout stable and avoids scroll-linked layout thrash */}
      <div ref={sentinelRef} className="h-1 w-full shrink-0" aria-hidden />

      {loadError ? (
        <div
          className="mt-8 flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-center"
          role="alert"
        >
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {loadError}
          </p>
          <button
            type="button"
            onClick={() => {
              setLoadError(null);
              void loadMore();
            }}
            className="text-xs font-medium tracking-widest uppercase transition-opacity hover:opacity-70"
            style={{ color: "var(--accent)" }}
          >
            Retry
          </button>
        </div>
      ) : null}

      {!hasMore && items.length > 0 ? (
        <p
          className="mt-12 text-center text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          You&apos;re all caught up
        </p>
      ) : null}
    </>
  );
}
