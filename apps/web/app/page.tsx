
import Hero from "@/app/components/Hero";
import WallpaperCard from "@/app/components/WallpaperCard";
import { getFeaturedWallpapers, getWallpapers } from "@/lib/api";
import { Wallpaper } from "@aura/types";

export default async function HomePage() {
  const [wallpapers, featuredWallpapers] = await Promise.all([
    getWallpapers(),
    getFeaturedWallpapers(),
  ]);

  return (
     <main className="min-h-screen bg-[#0a0a0a]">
      <div className="pt-16">
        <Hero wallpapers={featuredWallpapers} />
      </div>
      <div className="px-8 py-10">
        <h2 className="text-white/50 text-xs tracking-[0.3em] uppercase mb-6">
          Latest Wallpapers
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {wallpapers?.map((wallpaper: Wallpaper) => (
            <WallpaperCard key={wallpaper.id} wallpaper={wallpaper} />
          ))}
        </div>
      </div>
    </main>
  );
}