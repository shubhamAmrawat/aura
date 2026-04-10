import WallpaperCard from "@/app/components/WallpaperCard";
import { getWallpapers } from "@/lib/api";
import { Wallpaper } from "@aura/types";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trending | AURA",
  description: "Discover the most popular wallpapers on AURA right now.",
};

export default async function TrendingPage() {
  let wallpapers: Wallpaper[] = [];
  try {
    wallpapers = await getWallpapers({ limit: 50 });
  } catch {
    // render empty state on API error
  }

  return (
    <main className="min-h-screen pt-24 px-8 md:px-12" style={{ background: "var(--bg-primary)" }}>
      <div className="max-w-[1400px] mx-auto">
        <div className="mb-10">
          <h1
            className="text-2xl font-bold tracking-tight mb-1"
            style={{ color: "var(--text-primary)" }}
          >
            Trending
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Most popular wallpapers right now
          </p>
        </div>

        {wallpapers.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-24 rounded-2xl"
            style={{ border: "1px dashed var(--border)" }}
          >
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No trending wallpapers available right now.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {wallpapers.map((wallpaper) => (
              <WallpaperCard key={wallpaper.id} wallpaper={wallpaper} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
