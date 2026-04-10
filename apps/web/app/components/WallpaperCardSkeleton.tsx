"use client";

const ASPECT_RATIOS = [
  "aspect-[3/4]",
  "aspect-[5/6]",
  "aspect-square",
  "aspect-[2/3]",
];

interface WallpaperCardSkeletonProps {
  index?: number;
}

/**
 * Masonry-friendly placeholder; aspect varies by index to mimic a natural grid.
 */
export default function WallpaperCardSkeleton({ index = 0 }: WallpaperCardSkeletonProps) {
  const aspect = ASPECT_RATIOS[index % ASPECT_RATIOS.length];
  return (
    <div className={`break-inside-avoid mb-4 ${aspect} w-full rounded-2xl overflow-hidden`}>
      <div
        className="h-full w-full animate-pulse rounded-2xl"
        style={{ backgroundColor: "var(--bg-elevated)" }}
      />
    </div>
  );
}
