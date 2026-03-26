import WallpaperCard from "./components/WallpaperCard";
import Hero from "./components/Hero";
import { Wallpaper } from "@aura/types";
import { getWallpapers, getFeaturedWallpapers } from "@/lib/api";

export default async function HomePage() {
  const [wallpapers, featuredWallpapers] = await Promise.all([
    getWallpapers(),
    getFeaturedWallpapers(),
  ]);

  return (
    <main className="min-h-screen w-full" style={{ background: 'var(--bg-primary)' }}>
      {/* hero */}
      <div className="pt-[72px]">
        <Hero wallpapers={featuredWallpapers} />
      </div>

      {/* grid section */}
      <div className="w-full py-16" style={{ padding: '64px 80px' }}>

        {/* section header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2
              className="text-base font-semibold tracking-[0.15em] uppercase"
              style={{ color: 'var(--text-primary)' }}
            >
              Latest Wallpapers
            </h2>
            <p
              className="text-xs mt-1 tracking-wide"
              style={{ color: 'var(--text-secondary)' }}
            >
              {wallpapers?.length} wallpapers
            </p>
          </div>
          <button
            className="text-xs tracking-widest uppercase font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--accent)' }}
          >
            View All →
          </button>
        </div>

        {/* grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {wallpapers?.map((wallpaper: Wallpaper) => (
            <WallpaperCard key={wallpaper.id} wallpaper={wallpaper} />
          ))}
        </div>
      </div>
    </main>
  );
}