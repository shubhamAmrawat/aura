import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategories, getWallpaperById, getSimilarWallpapersPage, isNotFoundError } from "@/lib/api";
import WallpaperDetails from "@/app/wallpaper/WallpaperDetails";
import {
  SimilarWallpapersSection,
  type SimilarSqlRow,
} from "@/app/wallpaper/SimilarWallpapersSection";
import { ContextMenuBlock } from "@/app/wallpaper/ContextMenuBlock";
import { PhoneScreenPreview } from "@/app/wallpaper/PhoneScreenPreview";
import { ArrowLeft } from "lucide-react";
import { ViewTracker } from "@/app/wallpaper/ViewTracker";

interface WallpaperPageProps {
  params: Promise<{ id: string }>;
}

/** Back link that sits on the image (it used to be fixed and floated over the text while scrolling). */
const BackButton = ({ href, className }: { href: string; className: string }) => (
  <Link
    href={href}
    className={`absolute z-10 inline-flex items-center gap-2 h-9 pl-3 pr-3.5 rounded-full text-sm text-white bg-black/45 backdrop-blur-md hover:bg-black/60 transition-colors ${className}`}
  >
    <ArrowLeft size={15} strokeWidth={2} aria-hidden="true" />
    Back
  </Link>
);

export async function generateMetadata({ params }: WallpaperPageProps) {
  const { id } = await params;
  try {
    const wallpaper = await getWallpaperById(id);
    if (!wallpaper) return { title: "Wallpaper Not Found" };

    const resolution = `${wallpaper.width}×${wallpaper.height}`;
    const orientation = wallpaper.isMobile ? "Mobile" : "Desktop";

    return {
      title: `${wallpaper.title} — Free ${orientation} Wallpaper ${resolution}`,
      description: wallpaper.description ||
        `Download ${wallpaper.title} wallpaper in ${resolution} resolution. Free high-quality ${orientation.toLowerCase()} wallpaper.`,
      openGraph: {
        title: wallpaper.title,
        description: `${resolution} • Free Download`,
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
  } catch (e) {
    // Thrown here (before the page streams) so crawlers get a real 404 status.
    if (isNotFoundError(e)) notFound();
    return { title: "Wallpaper" };
  }
}

export default async function WallpaperPage({ params }: WallpaperPageProps) {
  const { id } = await params;

  const [wallpaperResult, similarResult, categoriesResult] = await Promise.allSettled([
    getWallpaperById(id),
    getSimilarWallpapersPage(id, { limit: 24, offset: 0 }),
    getCategories(),
  ]);

  // Deleted, disabled or in a hidden category → a real 404 (not a 200 "not found" page).
  if (wallpaperResult.status === "rejected" && isNotFoundError(wallpaperResult.reason)) notFound();
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

  // Portrait and (near-)square wallpapers get the side-by-side layout with phone previews.
  const isPortrait = wallpaper.isMobile || wallpaper.width <= wallpaper.height * 1.1;
  const categoryRow =
    categoriesResult.status === "fulfilled" ? categoriesResult.value.find((c) => c.id === wallpaper.categoryId) : undefined;
  const category = categoryRow ? { name: categoryRow.name, slug: categoryRow.slug } : null;
  const extraCategories =
    categoriesResult.status === "fulfilled"
      ? (wallpaper.extraCategoryIds ?? [])
          .map((cid) => categoriesResult.value.find((c) => c.id === cid))
          .filter((c): c is NonNullable<typeof c> => !!c)
          .map((c) => ({ name: c.name, slug: c.slug }))
      : [];

  const backHref = category ? `/category/${category.slug}` : "/";

  return (
    <main className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <ViewTracker wallpaperId={wallpaper.id} />

      {isPortrait ? (
        <>
          {/* mobile: stacked. md+: side-by-side (55 / 45 split) */}
          {/* the picture stays put (sticky) while the details scroll with the page — no scroll box inside the panel */}
          <div className="flex flex-col md:flex-row md:items-start pt-[72px]">

            {/* image panel — full width on mobile, 55% on desktop */}
            <ContextMenuBlock
              className="relative flex items-center justify-center w-full md:w-[55%] md:shrink-0 h-[min(80svh,700px)] md:h-[calc(100vh-72px)] md:sticky md:top-[72px] overflow-hidden"
            >
              <BackButton href={backHref} className="top-4 left-4 md:top-5 md:left-6" />
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
              <PhoneScreenPreview src={wallpaper.fileUrl} alt={wallpaper.title} width={wallpaper.width} height={wallpaper.height} />
            </ContextMenuBlock>

            {/* details panel — at least a screen tall; the action bar sticks to the bottom of the screen */}
            <div
              className="w-full md:w-[45%] md:shrink-0 flex flex-col md:min-h-[calc(100vh-72px)] px-6 pt-8 md:px-5 md:pt-6 lg:px-8 xl:px-10 xl:pt-8 border-t md:border-t-0 md:border-l"
              style={{ borderColor: "var(--border)" }}
            >
              <WallpaperDetails wallpaper={wallpaper} statsLayout="grid" category={category} extraCategories={extraCategories} />
            </div>

          </div>
        </>

      ) : (
        // landscape — full bleed image, details below
        <>
          <ContextMenuBlock className="relative w-full pt-[72px]" style={{ height: "85vh" }}>
            <BackButton href={backHref} className="top-[88px] left-6 md:left-12" />
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
                category={category}
                extraCategories={extraCategories}
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