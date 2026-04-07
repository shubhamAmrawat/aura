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
interface Category {
  id: string;
  name: string;
  slug: string;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { category, q } = await searchParams;

  const [wallpapersResult, featuredResult, categoriesResult] = await Promise.allSettled([
    getWallpapers({ category, q }),
    getFeaturedWallpapers(),
    getCategories(),
  ]);

  const wallpapers: Wallpaper[] =
    wallpapersResult.status === "fulfilled"
      ? (wallpapersResult.value as Wallpaper[])
      : [];
  const featuredWallpapers: Wallpaper[] =
    featuredResult.status === "fulfilled"
      ? (featuredResult.value as Wallpaper[])
      : [];
  const categories: Category[] =
    categoriesResult.status === "fulfilled"
      ? (categoriesResult.value as Category[])
      : [];
  const hasApiIssue =
    wallpapersResult.status === "rejected" ||
    featuredResult.status === "rejected" ||
    categoriesResult.status === "rejected";

  return (
    <main className="min-h-screen w-full" style={{ background: "var(--bg-primary)" }}>
      <div className="">
        <Hero wallpapers={featuredWallpapers} />
      </div>

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