import WallpaperCard from "./components/WallpaperCard";
import Hero from "./components/Hero";
import Link from "next/link";
import { Wallpaper } from "@aura/types";
import { getWallpapers, getFeaturedWallpapers, getCategories } from "@/lib/api";
import SearchBar from "@/app/components/SearchBar";
import CategoriesBar from "@/app/components/CategoriesBar";

interface HomePageProps {
  searchParams: Promise<{ category?: string; q?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { category, q } = await searchParams;

  const [wallpapers, featuredWallpapers, categories] = await Promise.all([
    getWallpapers({ category, q }),
    getFeaturedWallpapers(),
    getCategories(),
  ]);

  return (
    <main className="min-h-screen w-full" style={{ background: "var(--bg-primary)" }}>
      <div className="">
        <Hero wallpapers={featuredWallpapers} />
      </div>

      <div className="w-full px-12 pt-10 pb-4  flex flex-col items-center">
        <SearchBar defaultValue={q} />
        <CategoriesBar categories={categories} activeCategory={category} />
      </div>

      <div className="w-full py-8" style={{ padding: "32px 80px" }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2
              className="text-base font-semibold tracking-[0.15em] uppercase"
              style={{ color: "var(--text-primary)" }}
            >
              {category
                ? `${category.charAt(0).toUpperCase() + category.slice(1)} Wallpapers`
                : q
                ? `Results for "${q}"`
                : "Latest Wallpapers"}
            </h2>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
              {wallpapers?.length} wallpapers
            </p>
          </div>
          {(category || q) && (
            <Link
              href="/"
              className="text-xs tracking-widest uppercase font-medium transition-opacity hover:opacity-70"
              style={{ color: "var(--accent)" }}
            >
              Clear filter ×
            </Link>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {wallpapers?.length > 0 ? (
            wallpapers.map((wallpaper: Wallpaper) => (
              <WallpaperCard key={wallpaper.id} wallpaper={wallpaper} />
            ))
          ) : (
            <div className="col-span-5 py-20 text-center">
              <p style={{ color: "var(--text-secondary)" }}>
                No wallpapers found
              </p>
              <Link
                href="/"
                className="text-sm mt-3 block transition-opacity hover:opacity-70"
                style={{ color: "var(--accent)" }}
              >
                Browse all wallpapers
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}