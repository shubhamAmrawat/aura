

import WallpaperCard from "@/app/components/WallpaperCard";
import { Wallpaper } from "@aura/types";

export default async function HomePage() {
  const response = await fetch("http://localhost:3001/api/wallpapers", {
    cache: "no-store",
  });

  const { data: wallpapers } = await response.json();

  return (
    <main className="min-h-screen bg-[#0a0a0a] pt-20">
      <div className="px-8 py-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {wallpapers?.map((wallpaper: Wallpaper) => (
            <WallpaperCard key={wallpaper.id} wallpaper={wallpaper} />
          ))}
        </div>
      </div>
    </main>
  );
}