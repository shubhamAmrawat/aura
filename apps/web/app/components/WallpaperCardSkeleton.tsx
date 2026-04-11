"use client";

const ASPECT_RATIOS = [
  "aspect-[3/4]",
  "aspect-[5/6]",
  "aspect-square",
  "aspect-[2/3]",
];

interface WallpaperCardSkeletonProps {
  index?: number;
  /** Even grid (e.g. infinite-scroll loading row); avoids multicol clustering on one side. */
  uniform?: boolean;
}

/**
 * Masonry-friendly placeholder when `uniform` is false (aspect varies by index).
 * When `uniform` is true, uses one aspect ratio for a stable CSS Grid loading band.
 */
export default function WallpaperCardSkeleton({
  index = 0,
  uniform = false,
}: WallpaperCardSkeletonProps) {
  const aspect = uniform ? "aspect-[4/5]" : ASPECT_RATIOS[index % ASPECT_RATIOS.length];
  const layoutClass = uniform ? "w-full" : "break-inside-avoid mb-4 w-full";
  return (
    <div className={`${layoutClass} ${aspect} rounded-2xl overflow-hidden`}>
      <div
        className="h-full w-full animate-pulse rounded-2xl"
        style={{ backgroundColor: "var(--bg-elevated)" }}
      />
    </div>
  );
}
