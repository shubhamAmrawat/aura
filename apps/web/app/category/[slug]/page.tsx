import Link from "next/link";
import { getWallpapers, getCategories } from "@/lib/api";
import WallpaperCard from "@/app/components/WallpaperCard";
import { Wallpaper } from "@aura/types";
import type { Metadata } from "next";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const categories = await getCategories().catch(() => []);
  const cat = categories.find((c) => c.slug === slug);
  const name = cat?.name ?? slug.charAt(0).toUpperCase() + slug.slice(1);
  return {
    title: `${name} Wallpapers | AURA`,
    description: `Browse ${name} wallpapers curated on AURA.`,
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;

  const [wallpapers, categories] = await Promise.all([
    getWallpapers({ category: slug, limit: 100 }).catch((): Wallpaper[] => []),
    getCategories().catch(() => [] as { id: string; name: string; slug: string }[]),
  ]);

  const category = categories.find((c) => c.slug === slug);
  const categoryName =
    category?.name ?? slug.charAt(0).toUpperCase() + slug.slice(1);

  return (
    <main
      className="min-h-screen pt-24 px-8 md:px-12"
      style={{ background: "var(--bg-primary)" }}
    >
      <div className="max-w-[1400px] mx-auto">

        {/* Page header */}
        <div className="mb-10">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs tracking-widest uppercase mb-5 transition-opacity hover:opacity-70"
            style={{ color: "var(--text-muted)" }}
          >
            ← All Categories
          </Link>
          <h1
            className="text-2xl font-bold tracking-tight mb-1"
            style={{ color: "var(--text-primary)" }}
          >
            {categoryName}
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {wallpapers.length} wallpaper{wallpapers.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Wallpaper grid or empty state */}
        {wallpapers.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-24 rounded-2xl"
            style={{ border: "1px dashed var(--border)" }}
          >
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="mb-4"
              style={{ color: "var(--text-muted)" }}
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <p className="text-sm mb-1" style={{ color: "var(--text-muted)" }}>
              No wallpapers in this category yet.
            </p>
            <Link
              href="/"
              className="text-xs mt-3 transition-opacity hover:opacity-70"
              style={{ color: "var(--accent)" }}
            >
              ← Browse all wallpapers
            </Link>
          </div>
        ) : (
          <div className="columns-2 sm:columns-3 md:columns-4 xl:columns-5 gap-4">
            {wallpapers.map((wallpaper: Wallpaper) => (
              <div key={wallpaper.id} className="break-inside-avoid mb-4">
                <WallpaperCard wallpaper={wallpaper} />
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
