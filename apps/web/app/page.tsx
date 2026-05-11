import Hero from "./components/Hero";
import LatestWallpapersInfinite from "./components/LatestWallpapersInfinite";
import Link from "next/link";
import { Wallpaper } from "@aura/types";
import { getWallpapersPage, getFeaturedWallpapers, WALLPAPERS_FEED_PAGE_SIZE } from "@/lib/api";

export default async function HomePage() {
  const [wallpapersResult, featuredResult] = await Promise.allSettled([
    getWallpapersPage({ limit: WALLPAPERS_FEED_PAGE_SIZE, offset: 0 }),
    getFeaturedWallpapers(),
  ]);

  const wallpapers: Wallpaper[] =
    wallpapersResult.status === "fulfilled" ? wallpapersResult.value.data : [];
  const initialHasMore =
    wallpapersResult.status === "fulfilled" ? wallpapersResult.value.hasMore : false;
  const featuredWallpapers: Wallpaper[] =
    featuredResult.status === "fulfilled" ? featuredResult.value : [];

  const hasApiIssue =
    wallpapersResult.status === "rejected" || featuredResult.status === "rejected";

  return (
    <main className="min-h-screen w-full" style={{ background: "var(--bg-primary)" }}>
      <Hero wallpapers={featuredWallpapers} />

      {hasApiIssue && (
        <div className="w-full px-6 md:px-12 pt-6">
          <div
            className="mx-auto max-w-6xl rounded-xl px-4 py-3 text-sm flex flex-col md:flex-row md:items-center md:justify-between gap-2"
            style={{
              background: "rgba(255, 193, 7, 0.08)",
              border: "1px solid rgba(255, 193, 7, 0.35)",
              color: "var(--text-primary)",
            }}
          >
            <span>
              Some content could not be loaded right now. The API may be temporarily unavailable.
            </span>
            <Link
              href="/"
              className="text-xs tracking-widest uppercase font-medium transition-opacity hover:opacity-70"
              style={{ color: "var(--accent)" }}
            >
              Retry
            </Link>
          </div>
        </div>
      )}

      {/*
        Slim About banner — short editorial line that gives the home page
        real content for crawlers and AdSense reviewers without disrupting
        the visual rhythm of Hero → grid.
      */}
      <div
        className="w-full px-4 sm:px-8 md:px-12 pt-8 border-t"
        style={{ borderColor: "var(--border)" }}
      >
        <p
          className="max-w-3xl mx-auto text-sm leading-relaxed text-center"
          style={{ color: "var(--text-secondary)" }}
        >
          Aurora is a curated wallpaper discovery platform featuring thousands
          of high-resolution wallpapers from independent photographers and
          digital artists. Every wallpaper is hand-reviewed for quality. Free
          to explore, free to download.
        </p>
      </div>

      <div className="w-full px-4 sm:px-8 md:px-12 py-8">
        <LatestWallpapersInfinite
          initialWallpapers={wallpapers}
          initialHasMore={initialHasMore}
        />
      </div>
    </main>
  );
}
