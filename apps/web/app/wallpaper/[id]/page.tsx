import Image from "next/image";
import Link from "next/link";
import { getWallpaperById, getSimilarWallpapersPage } from "@/lib/api";
import { Wallpaper } from "@aura/types";
import WallpaperDetails from "@/app/wallpaper/WallpaperDetails";
import {
  SimilarWallpapersSection,
  type SimilarSqlRow,
} from "@/app/wallpaper/SimilarWallpapersSection";
import { ContextMenuBlock } from "@/app/wallpaper/ContextMenuBlock";
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
    getSimilarWallpapersPage(id, { limit: 24, offset: 0 }),
  ]);

  const wallpaper = wallpaperResult.status === "fulfilled" ? wallpaperResult.value : null;
  const similarPayload =
    similarResult.status === "fulfilled" ? similarResult.value : null;
  const others: SimilarSqlRow[] = similarPayload
    ? (similarPayload.data as SimilarSqlRow[])
    : [];
  const similarHasMore = similarPayload?.hasMore ?? false;

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

  const isPortrait = wallpaper.height > wallpaper.width;

  return (
    <main className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <BackButton wallpaper={wallpaper} />

      {isPortrait ? (
        <>
          {/* mobile: stacked. md+: side-by-side (55 / 45 split) */}
          <div className="flex flex-col md:flex-row pt-[72px] md:overflow-hidden md:min-h-screen">

            {/* image panel — full width on mobile, 55% on desktop */}
            <ContextMenuBlock
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
            </ContextMenuBlock>

            {/* details panel — md+: flex column + max height; inner scroll keeps actions visible */}
            <div
              className="w-full md:w-[45%] md:shrink-0 md:flex md:h-[calc(100vh-72px)] md:min-h-0 md:flex-col md:overflow-hidden px-6 py-8 md:px-5 md:py-4 lg:px-8 lg:py-6 xl:px-10 xl:py-8 border-t md:border-t-0 md:border-l"
              style={{ borderColor: "var(--border)" }}
            >
              <WallpaperDetails wallpaper={wallpaper} statsLayout="grid" />
            </div>

          </div>
        </>

      ) : (
        // landscape — full bleed image, details below
        <>
          <ContextMenuBlock className="relative w-full pt-[72px]" style={{ height: "85vh" }}>
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
          </ContextMenuBlock>

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

      <SimilarWallpapersSection
        key={id}
        wallpaperId={id}
        initialWallpapers={others}
        initialHasMore={similarHasMore}
      />
    </main>
  );
}