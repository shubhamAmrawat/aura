import { MetadataRoute } from "next";

const BASE_URL = "https://www.aurora-walls.com";
const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE_URL}/trending`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE_URL}/latest`, changeFrequency: "hourly", priority: 0.9 },
  ];

  // categories
  let categoryPages: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${API_URL}/api/categories`, { cache: "no-store" });
    const { data } = await res.json();
    categoryPages = data.map((c: { slug: string }) => ({
      url: `${BASE_URL}/category/${c.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    }));
  } catch {}

  // wallpapers — fetch all in batches
  let wallpaperPages: MetadataRoute.Sitemap = [];
  try {
    let allWallpapers: any[] = [];
    let offset = 0;
    const batchSize = 100;

    while (true) {
      const res = await fetch(
        `${API_URL}/api/wallpapers?limit=${batchSize}&offset=${offset}`,
        { cache: "no-store" }
      );
      const { data, hasMore } = await res.json();
      allWallpapers = [...allWallpapers, ...data];
      if (!hasMore || data.length === 0) break;
      offset += batchSize;
    }

    wallpaperPages = allWallpapers.map(
      (w: { id: string; updatedAt?: string; createdAt: string }) => ({
        url: `${BASE_URL}/wallpaper/${w.id}`,
        lastModified: new Date(w.updatedAt ?? w.createdAt),
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })
    );
  } catch {}

  return [...staticPages, ...categoryPages, ...wallpaperPages];
}