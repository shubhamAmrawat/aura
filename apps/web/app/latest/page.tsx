import { LatestWallpapersLoadMore } from "@/app/components/LatestWallpapersLoadMore";
import { getWallpapers } from "@/lib/api";
import { getDevice } from "@/lib/device.server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Latest | Aurora",
  description: "Freshest wallpapers from our creators.",
};

export default async function LatestPage() {
  const device = await getDevice();
  const [result] = await Promise.allSettled([getWallpapers({ limit: 20, device })]);

  const initialWallpapers = result.status === "fulfilled" ? result.value.data : [];
  const initialHasMore = result.status === "fulfilled" ? result.value.hasMore : false;

  return (
    <main
      className="min-h-screen pt-24 px-8 md:px-12 pb-16"
      style={{ background: "var(--bg-primary)" }}
    >
      <div className="max-w-[1400px] mx-auto">
        <div className="mb-10">
          <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            Latest
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Freshest wallpapers from our creators
          </p>
        </div>
        <LatestWallpapersLoadMore
          key={device}
          device={device}
          initialWallpapers={initialWallpapers}
          initialHasMore={initialHasMore}
        />
      </div>
    </main>
  );
}
