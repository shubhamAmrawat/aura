"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Wallpaper } from "@aura/types";
import WallpaperCard from "./WallpaperCard";
import WallpaperCardSkeleton from "./WallpaperCardSkeleton";
import {
  getWallpapersPage,
  getTrendingWallpapers,
  getPersonalizedFeed,
  WALLPAPERS_FEED_PAGE_SIZE,
} from "@/lib/api";
import DeviceEmptyState from "./DeviceEmptyState";
import type { Device } from "@/lib/device";
import { useAuth } from "@/lib/authContext";
import { Sparkles, Flame, Clock } from "lucide-react";

const SKELETON_COUNT = 16;
/** Expand the viewport’s intersection box downward so loads start well before the footer. */
const ROOT_MARGIN = "0px 0px 1200px 0px";
/** If IO misses (e.g. stuck at max scroll with footer visible), still fetch when this close to the bottom. */
const SCROLL_PX_FROM_BOTTOM = 720;

export type FeedTab = "for-you" | "trending" | "latest";

interface LatestWallpapersInfiniteProps {
  initialWallpapers: Wallpaper[];
  initialHasMore: boolean;
  device?: Device;
  initialTab?: FeedTab;
}

export default function LatestWallpapersInfinite({
  initialWallpapers,
  initialHasMore,
  device,
  initialTab = "for-you",
}: LatestWallpapersInfiniteProps) {
  const { user, likedIds } = useAuth();
  const [tab, setTab] = useState<FeedTab>(initialTab);
  const [items, setItems] = useState<Wallpaper[]>(initialWallpapers);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(initialHasMore);
  const nextOffsetRef = useRef(initialWallpapers.length);
  const tabRef = useRef<FeedTab>(tab);

  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  const fetchForTab = useCallback(
    async (currentTab: FeedTab, offset: number) => {
      const guestIds = !user && likedIds.size > 0 ? Array.from(likedIds) : undefined;

      if (currentTab === "for-you") {
        return getPersonalizedFeed({
          offset,
          limit: WALLPAPERS_FEED_PAGE_SIZE,
          device,
          guestIds,
        });
      }
      if (currentTab === "trending") {
        return getTrendingWallpapers({
          offset,
          limit: WALLPAPERS_FEED_PAGE_SIZE,
          device,
        });
      }
      return getWallpapersPage({
        offset,
        limit: WALLPAPERS_FEED_PAGE_SIZE,
        device,
      });
    },
    [device, user, likedIds]
  );

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);
    setLoadError(null);

    const offset = nextOffsetRef.current;
    const currentTab = tabRef.current;

    try {
      const { data, hasMore: more } = await fetchForTab(currentTab, offset);

      // Verify the tab hasn't changed during the async request
      if (tabRef.current !== currentTab) return;

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
  }, [fetchForTab]);

  const switchTab = async (newTab: FeedTab) => {
    if (newTab === tab || loadingRef.current) return;
    setTab(newTab);
    tabRef.current = newTab;
    setItems([]);
    setIsLoading(true);
    setLoadError(null);
    nextOffsetRef.current = 0;
    hasMoreRef.current = true;

    try {
      const { data, hasMore: more } = await fetchForTab(newTab, 0);
      if (tabRef.current !== newTab) return;
      setItems(data);
      nextOffsetRef.current = data.length;
      const effectiveHasMore = more && data.length > 0;
      hasMoreRef.current = effectiveHasMore;
      setHasMore(effectiveHasMore);
    } catch {
      setLoadError("Couldn't switch feed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const maybeLoadFromScrollPosition = useCallback(() => {
    if (!hasMoreRef.current || loadingRef.current) return;
    const root = document.scrollingElement ?? document.documentElement;
    const fromBottom = root.scrollHeight - root.scrollTop - root.clientHeight;
    if (fromBottom <= SCROLL_PX_FROM_BOTTOM) void loadMore();
  }, [loadMore]);

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

  useEffect(() => {
    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        maybeLoadFromScrollPosition();
      });
    };
    maybeLoadFromScrollPosition();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [maybeLoadFromScrollPosition]);

  useEffect(() => {
    if (!hasMore || isLoading) return;
    const id = requestAnimationFrame(() => maybeLoadFromScrollPosition());
    return () => cancelAnimationFrame(id);
  }, [hasMore, isLoading, items.length, maybeLoadFromScrollPosition]);

  const showEmptyState = items.length === 0 && !isLoading;

  return (
    <>
      {/* Feed Navigation Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2
            className="text-base font-semibold tracking-[0.15em] uppercase"
            style={{ color: "var(--text-primary)" }}
          >
            Explore
          </h2>
          <div className="text-xs mt-1 space-y-0.5" style={{ color: "var(--text-secondary)" }}>
            <p>
              {tab === "for-you"
                ? user
                  ? "Personalized to your taste, downloads & likes"
                  : likedIds.size > 0
                  ? "Personalized based on wallpapers you liked in this session"
                  : "Curated aesthetic feed — like wallpapers to tune your recommendations"
                : tab === "trending"
                ? "Highest community momentum, saves and velocity"
                : "Latest arrivals and hand-reviewed submissions"}
            </p>
          </div>
        </div>

        {/* Tab Switcher Pills */}
        <div
          className="inline-flex items-center p-1 rounded-full border self-start md:self-auto"
          style={{
            background: "var(--bg-secondary, rgba(255, 255, 255, 0.04))",
            borderColor: "var(--border, rgba(255, 255, 255, 0.1))",
          }}
          role="tablist"
          aria-label="Feed selection"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "for-you"}
            onClick={() => switchTab("for-you")}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all"
            style={{
              background: tab === "for-you" ? "var(--accent, #6366f1)" : "transparent",
              color: tab === "for-you" ? "#ffffff" : "var(--text-secondary)",
              boxShadow: tab === "for-you" ? "0 2px 8px rgba(99, 102, 241, 0.35)" : "none",
            }}
          >
            <Sparkles size={13} className={tab === "for-you" ? "animate-pulse" : ""} />
            <span>For You</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={tab === "trending"}
            onClick={() => switchTab("trending")}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all"
            style={{
              background: tab === "trending" ? "var(--accent, #6366f1)" : "transparent",
              color: tab === "trending" ? "#ffffff" : "var(--text-secondary)",
              boxShadow: tab === "trending" ? "0 2px 8px rgba(99, 102, 241, 0.35)" : "none",
            }}
          >
            <Flame size={13} />
            <span>Trending</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={tab === "latest"}
            onClick={() => switchTab("latest")}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all"
            style={{
              background: tab === "latest" ? "var(--accent, #6366f1)" : "transparent",
              color: tab === "latest" ? "#ffffff" : "var(--text-secondary)",
              boxShadow: tab === "latest" ? "0 2px 8px rgba(99, 102, 241, 0.35)" : "none",
            }}
          >
            <Clock size={13} />
            <span>Latest</span>
          </button>
        </div>
      </div>

      {showEmptyState && device && device !== "all" ? (
        <DeviceEmptyState device={device} />
      ) : showEmptyState ? (
        <div className="py-20 text-center">
          <p style={{ color: "var(--text-secondary)" }}>No wallpapers found</p>
        </div>
      ) : (
        <>
          <div className="columns-2 sm:columns-3 md:columns-4 xl:columns-5 gap-4">
            {items.map((wallpaper, index) => (
              <div
                key={`${tab}-${wallpaper.id}`}
                className="break-inside-avoid mb-4"
                style={{ contentVisibility: "auto" }}
              >
                <WallpaperCard wallpaper={wallpaper} priority={index === 0} />
              </div>
            ))}
          </div>
          {isLoading ? (
            <div
              className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5"
              aria-busy="true"
              aria-label="Loading more wallpapers"
            >
              {Array.from({ length: SKELETON_COUNT }, (_, i) => (
                <WallpaperCardSkeleton key={`loading-${i}`} uniform />
              ))}
            </div>
          ) : null}
        </>
      )}

      {/* Invisible sentinel */}
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
        <p className="mt-12 text-center text-xs" style={{ color: "var(--text-muted)" }}>
          You&apos;re all caught up
        </p>
      ) : null}
    </>
  );
}
