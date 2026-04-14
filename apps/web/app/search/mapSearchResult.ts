import type { Wallpaper } from "@aura/types";

/** Map raw SQL / API rows (snake_case or camelCase) to Wallpaper for WallpaperCard. */
export function mapSearchResult(w: Record<string, unknown>): Wallpaper {
  const fmt = (w.format as string) ?? "jpeg";
  const allowed = ["jpeg", "png", "webp", "avif"] as const;
  const format = allowed.includes(fmt as (typeof allowed)[number])
    ? (fmt as Wallpaper["format"])
    : "jpeg";

  return {
    id: String(w.id),
    title: String(w.title ?? ""),
    description: (w.description as string | null) ?? null,
    fileUrl: String(w.file_url ?? w.fileUrl ?? ""),
    blurhash: String(w.blurhash ?? ""),
    dominantColor: String(w.dominant_color ?? w.dominantColor ?? ""),
    palette: Array.isArray(w.palette) ? (w.palette as string[]) : [],
    width: Number(w.width),
    height: Number(w.height),
    likeCount: Number(w.like_count ?? w.likeCount ?? 0),
    downloadCount: Number(w.download_count ?? w.downloadCount ?? 0),
    fileSizeBytes: Number(w.file_size_bytes ?? w.fileSizeBytes ?? 0),
    format,
    tags: Array.isArray(w.tags) ? (w.tags as string[]) : [],
    isFeatured: Boolean(w.is_featured ?? w.isFeatured ?? false),
    isPremium: Boolean(w.is_premium ?? w.isPremium ?? false),
    isMobile: Boolean(w.is_mobile ?? w.isMobile ?? Number(w.height) >= Number(w.width)),
    createdAt: String(w.created_at ?? w.createdAt ?? new Date().toISOString()),
  };
}
