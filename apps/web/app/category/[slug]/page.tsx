import Link from "next/link";
import { getWallpapers, getCategories } from "@/lib/api";
import { CategoryWallpaperGrid } from "@/app/components/CategoryWallpaperGrid";
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
    title: `${name} Wallpapers | Aurora`,
    description: `Browse ${name} wallpapers curated on Aurora.`,
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;

  const [categories, wallpapersResult] = await Promise.allSettled([
    getCategories(),
    getWallpapers({ category: slug, limit: 20 }),
  ]);

  const allCategories = categories.status === "fulfilled" ? categories.value : [];
  const initialWallpapers =
    wallpapersResult.status === "fulfilled" ? wallpapersResult.value.data : [];
  const initialHasMore =
    wallpapersResult.status === "fulfilled" ? wallpapersResult.value.hasMore : false;

  const category = allCategories.find((c) => c.slug === slug);

  return (
    <main
      className="min-h-screen pt-24 px-8 md:px-12"
      style={{ background: "var(--bg-primary)" }}
    >
      <div className="max-w-[1400px] mx-auto">
        <div className="mb-10">
          <Link
            href="/"
            className="text-xs tracking-widest uppercase transition-opacity hover:opacity-60 mb-4 inline-block"
            style={{ color: "var(--text-muted)" }}
          >
            ← Back
          </Link>
          <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            {category?.name ?? slug}
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {category?.description ?? `Browse ${slug} wallpapers`}
          </p>
        </div>

        <CategoryWallpaperGrid
          slug={slug}
          initialWallpapers={initialWallpapers}
          initialHasMore={initialHasMore}
        />
      </div>
    </main>
  );
}
