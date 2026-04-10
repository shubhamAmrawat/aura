import WallpaperCard from "./components/WallpaperCard";
import Hero from "./components/Hero";
import Link from "next/link";
import { Wallpaper } from "@aura/types";
import { getWallpapers, getFeaturedWallpapers } from "@/lib/api";

export default async function HomePage() {
  const [wallpapersResult, featuredResult] = await Promise.allSettled([
    getWallpapers({ limit: 100 }),
    getFeaturedWallpapers(),
  ]);

  const wallpapers: Wallpaper[] =
    wallpapersResult.status === "fulfilled" ? wallpapersResult.value : [];
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

      <div className="w-full px-4 sm:px-8 md:px-12 py-8">
        <div className="mb-8">
          <h2
            className="text-base font-semibold tracking-[0.15em] uppercase"
            style={{ color: "var(--text-primary)" }}
          >
            Latest Wallpapers
          </h2>
          <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
            {wallpapers.length} wallpapers
          </p>
        </div>

        {wallpapers.length > 0 ? (
          <div className="columns-2 sm:columns-3 md:columns-4 xl:columns-5 gap-4">
            {wallpapers.map((wallpaper: Wallpaper) => (
              <div key={wallpaper.id} className="break-inside-avoid mb-4">
                <WallpaperCard wallpaper={wallpaper} />
              </div>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center">
            <p style={{ color: "var(--text-secondary)" }}>No wallpapers found</p>
          </div>
        )}
      </div>
    </main>
  );
}
