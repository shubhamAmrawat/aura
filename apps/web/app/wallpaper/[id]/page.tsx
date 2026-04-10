import Image from "next/image";
import Link from "next/link";
import { getWallpaperById, getWallpapers } from "@/lib/api";
import { Wallpaper } from "@aura/types";
import WallpaperCard from "@/app/components/WallpaperCard";
import WallpaperDetails from "@/app/wallpaper/WallpaperDetails";
import { getContrastColor } from "@/lib/color";

interface WallpaperPageProps {
  params: Promise<{ id: string }>;
}

const BackButton = ({ wallpaper }: { wallpaper: Wallpaper }) => (
  <div className="fixed top-24 left-12 z-50">
    <Link
      href="/"
      className="inline-flex items-center justify-center gap-2 text-sm px-3 py-1.5 rounded-full  transition-opacity hover:opacity-90 cursor-pointer"
      style={{
        backgroundColor: getContrastColor(wallpaper.dominantColor),
        color: wallpaper.dominantColor,

      }}
    >

      ← Back
    </Link>
  </div>
);

const SimilarWallpapers = ({ wallpapers }: { wallpapers: Wallpaper[] }) => {
  if (wallpapers.length === 0) return null;

  return (
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
        <div className="columns-2 sm:columns-3 md:columns-4 xl:columns-5 gap-4">
          {wallpapers.map((w) => (
            <div key={w.id} className="break-inside-avoid mb-4">
              <WallpaperCard wallpaper={w} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export async function generateMetadata({ params }: WallpaperPageProps) {
  const { id } = await params;
  try {
    const wallpaper = await getWallpaperById(id);
    if (!wallpaper) return { title: "Wallpaper Not Found" };

    return {
      title: wallpaper.title,
      description: wallpaper.description || `Download ${wallpaper.title} — ${wallpaper.width}×${wallpaper.height} wallpaper`,
      openGraph: {
        title: wallpaper.title,
        description: wallpaper.description || `${wallpaper.width}×${wallpaper.height} wallpaper`,
        images: [
          {
            url: wallpaper.fileUrl,
            width: wallpaper.width,
            height: wallpaper.height,
            alt: wallpaper.title,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: wallpaper.title,
        images: [wallpaper.fileUrl],
      },
    };
  } catch {
    return { title: "Wallpaper" };
  }
}

export default async function WallpaperPage({ params }: WallpaperPageProps) {
  const { id } = await params;

  const [wallpaperResult, similarResult] = await Promise.allSettled([
    getWallpaperById(id),
    getWallpapers({ limit: 20 }),
  ]);

  const wallpaper = wallpaperResult.status === "fulfilled" ? wallpaperResult.value : null;
  const similarWallpapers = similarResult.status === "fulfilled" ? similarResult.value : [];

  if (!wallpaper) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg-primary)" }}
      >
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Wallpaper not found.</p>
      </div>
    );
  }

  const others = similarWallpapers
    ?.filter((w: Wallpaper) => w.id !== id)
    .slice(0, 19) ?? [];

  const isPortrait = wallpaper.height > wallpaper.width;

  return (
    <main className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <BackButton wallpaper={wallpaper} />

      {isPortrait ? (
        <>
          {/* mobile: stacked. md+: side-by-side (55 / 45 split) */}
          <div className="flex flex-col md:flex-row pt-[72px] md:overflow-hidden md:min-h-screen">

            {/* image panel — full width on mobile, 55% on desktop */}
            <div
              className="relative flex items-center justify-center w-full md:w-[55%] md:shrink-0 h-[60vw] min-h-[320px] md:h-[calc(100vh-72px)] overflow-hidden"

            >
              {/* blurred background — same image, heavily blurred */}
              <Image
                src={wallpaper.fileUrl}
                alt=""
                fill
                sizes="55vw"
                className="object-cover scale-110"
                style={{ filter: "blur(40px)", transform: "scale(1.2)" }}
                priority
                aria-hidden
              />
              <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.45)" }} />
              <div
                className="relative w-full h-full flex items-center justify-center"
                style={{ maxWidth: "85%", maxHeight: "90%" }}
              >
                <Image
                  src={wallpaper.fileUrl}
                  alt={wallpaper.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 55vw"
                  className="object-contain rounded-xl"
                  priority
                />
              </div>
            </div>

            {/* details panel — full width on mobile, 45% scrollable on desktop */}
            <div
              className="w-full md:w-[45%] md:shrink-0 md:overflow-y-auto px-6 py-8 md:px-10 md:py-12 md:max-h-[calc(100vh-72px)] border-t md:border-t-0 md:border-l"
              style={{ borderColor: "var(--border)" }}
            >
              <WallpaperDetails wallpaper={wallpaper} statsLayout="grid" />
            </div>

          </div>
        </>

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
            {/* <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to top, rgba(10,10,10,0.9) 0%, transparent 0.5%)",
              }}
            /> */}
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