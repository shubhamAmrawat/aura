import Link from "next/link";
import { permanentRedirect } from "next/navigation";
import { getWallpapers, getCategories, resolveCategorySlug } from "@/lib/api";
import { CategoryWallpaperGrid } from "@/app/components/CategoryWallpaperGrid";
import { getDevice } from "@/lib/device.server";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const name = slug.charAt(0).toUpperCase() + slug.slice(1);
  return {
    title: `${name} Wallpapers — Free 4K Download`,
    description: `Browse and download free ${name.toLowerCase()} wallpapers in 4K resolution. Updated daily with new high-quality wallpapers for mobile and desktop.`,
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const device = await getDevice();

  const [categories, wallpapersResult] = await Promise.allSettled([
    getCategories(),
    getWallpapers({ category: slug, limit: 20, device }),
  ]);

  const allCategories = categories.status === "fulfilled" ? categories.value : [];
  const initialWallpapers =
    wallpapersResult.status === "fulfilled" ? wallpapersResult.value.data : [];
  const initialHasMore =
    wallpapersResult.status === "fulfilled" ? wallpapersResult.value.hasMore : false;

  const category = allCategories.find((c) => c.slug === slug);

  // Renamed or merged category → 308 to its current address (keeps old links and search rankings)
  if (!category && categories.status === "fulfilled") {
    const current = await resolveCategorySlug(slug);
    if (current && current !== slug) permanentRedirect(`/category/${current}`);
  }

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
          key={device}
          device={device}
          slug={slug}
          initialWallpapers={initialWallpapers}
          initialHasMore={initialHasMore}
        />
      </div>
    </main>
  );
}
