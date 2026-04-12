import { getTrendingWallpapers } from "@/lib/api";
import { Wallpaper } from "@aura/types";
import Link from "next/link";
import TrendingGrid from "./TrendingGrid";

export default async function TrendingPage() {
  const [result] = await Promise.allSettled([
    getTrendingWallpapers({ limit: 20 }),
  ]);

  const initialWallpapers = result.status === "fulfilled" ? result.value.data : [];
  const initialHasMore = result.status === "fulfilled" ? result.value.hasMore : false;

  return (
    <main
      className="min-h-screen pt-24 px-8 md:px-12 pb-16"
      style={{ background: "var(--bg-primary)" }}
    >
      <div className="max-w-[1400px] mx-auto">
        <div className="mb-10">
          <h1
            className="text-2xl font-bold mb-1"
            style={{ color: "var(--text-primary)" }}
          >
            Trending
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Most popular wallpapers right now · scores updated hourly
          </p>
        </div>

        <TrendingGrid
          initialWallpapers={initialWallpapers}
          initialHasMore={initialHasMore}
        />
      </div>
    </main>
  );
}