import Image from "next/image";
import Link from "next/link";
import { getWallpaperById, getWallpapers } from "@/lib/api";
import { Wallpaper } from "@aura/types";
import WallpaperCard from "@/app/components/WallpaperCard";
import WallpaperDetails from "@/app//wallpaper/WallpaperDetails";

interface WallpaperPageProps {
  params: Promise<{ id: string }>;
}

const BackButton = () => (
  <div className="fixed top-24 left-12 z-50">
    <Link
      href="/"
      className="flex items-center gap-2 text-sm px-4 py-2 rounded-full backdrop-blur-md transition-opacity hover:opacity-70"
      style={{
        background: "rgba(10,10,10,0.6)",
        color: "var(--text-secondary)",
        border: "1px solid var(--border)",
      }}
    >
      ← Back
    </Link>
  </div>
);

const SimilarWallpapers = ({ wallpapers }: { wallpapers: Wallpaper[] }) => (
  <div
    className="px-8 md:px-12 py-16"
    style={{ borderTop: "1px solid var(--border)" }}
  >
    <div className="max-w-[1400px] mx-auto">
      <div className="mb-8">
        <h2
          className="text-base font-semibold tracking-[0.15em] uppercase"
          style={{ color: "var(--text-primary)" }}
        >
          More Wallpapers
        </h2>
        <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
          You might also like
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {wallpapers.map((w) => (
          <WallpaperCard key={w.id} wallpaper={w} />
        ))}
      </div>
    </div>
  </div>
);

export default async function WallpaperPage({ params }: WallpaperPageProps) {
  const { id } = await params;

  const [wallpaper, similarWallpapers] = await Promise.all([
    getWallpaperById(id),
    getWallpapers(),
  ]);

  if (!wallpaper) {
    return (
      <main
        className="min-h-screen pt-20 flex items-center justify-center"
        style={{ background: "var(--bg-primary)" }}
      >
        <div className="text-center">
          <p style={{ color: "var(--text-secondary)" }}>Wallpaper not found</p>
          <Link
            href="/"
            style={{ color: "var(--accent)" }}
            className="text-sm mt-4 block"
          >
            ← Back to home
          </Link>
        </div>
      </main>
    );
  }

  const others = similarWallpapers
    ?.filter((w: Wallpaper) => w.id !== id)
    .slice(0, 5) ?? [];

  const isPortrait = wallpaper.height > wallpaper.width;

  return (
    <main className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <BackButton />

      {isPortrait ? (
        // portrait — side by side, fixed column widths
        <div
          className="flex pt-[72px] overflow-hidden"
          style={{ minHeight: "100vh" }}
        >
          {/* left — wallpaper, fixed 55% */}
          <div
            className="relative flex items-center justify-center flex-shrink-0"
            style={{
              width: "55%",
              minHeight: "calc(100vh - 72px)",
              background: wallpaper.dominantColor,
            }}
          >
            <div
              className="absolute inset-0"
              style={{ background: "rgba(0,0,0,0.15)" }}
            />
            <div
              className="relative"
              style={{
                height: "calc(100vh - 72px - 48px)",
                aspectRatio: `${wallpaper.width} / ${wallpaper.height}`,
                maxWidth: "85%",
                maxHeight: "90%",
              }}
            >
              <Image
                src={wallpaper.fileUrl}
                alt={wallpaper.title}
                fill
                sizes="55vw"
                className="object-cover rounded-xl"
                priority
              />
            </div>
          </div>

          {/* right — details, fixed 45%, scrollable */}
          <div
            className="flex-shrink-0 overflow-y-auto px-10 py-12"
            style={{
              width: "45%",
              borderLeft: "1px solid var(--border)",
              maxHeight: "calc(100vh - 72px)",
            }}
          >
            <WallpaperDetails wallpaper={wallpaper} statsLayout="grid" />
          </div>
        </div>

      ) : (
        // landscape — full bleed image, details below
        <>
          <div className="relative w-full pt-[72px]" style={{ height: "85vh" }}>
            <Image
              src={wallpaper.fileUrl}
              alt={wallpaper.title}
              fill
              sizes="100vw"
              className="object-cover"
              priority
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to top, rgba(10,10,10,0.9) 0%, transparent 4%)",
              }}
            />
          </div>

          {/* details — title left, download top right */}
          <div
            className="w-full px-8 md:px-12 py-12"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <div className="max-w-[1400px] mx-auto">
              <WallpaperDetails
                wallpaper={wallpaper}
                statsLayout="row"
              />
            </div>
          </div>
        </>
      )}

      <SimilarWallpapers wallpapers={others} />
    </main>
  );
}