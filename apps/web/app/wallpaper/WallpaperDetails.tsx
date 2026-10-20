import { Wallpaper } from "@aura/types";
import { getContrastColor } from "@/lib/color";
import WallpaperStats from "./WallpaperStats";
import ColorPalette from "./ColorPalette";
import WallpaperTags from "./WallpaperTags";
import DownloadButton from "./DownloadButton";
import LikeButton from "@/app/components/LikeButton";
import BookmarkButton from "@/app/components/BookmarkButton";
import AboutWallpaper from "./AboutWallpaper";

interface WallpaperDetailsProps {
  wallpaper: Wallpaper;
  statsLayout?: "row" | "grid";
  /** The wallpaper's category, for the "About" text and link. */
  category?: { name: string; slug: string } | null;
  /** other categories it is also listed in */
  extraCategories?: { name: string; slug: string }[];
}

const WallpaperDetails = ({
  wallpaper,
  statsLayout = "row",
  category = null,
  extraCategories = [],
}: WallpaperDetailsProps) => {
  const contrastColor = getContrastColor(wallpaper.dominantColor);
  const isPortrait = statsLayout === "grid";

  if (isPortrait) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex flex-col gap-4">
          <div
            className="inline-block text-xs tracking-[0.3em] uppercase px-3 py-1 rounded-full w-fit"
            style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
          >
            Mobile Wallpaper
          </div>

          <div>
            <h1
              className="text-[26px] font-bold leading-[1.15] tracking-tight md:text-[28px] lg:text-[32px] mb-2 md:mb-3"
              style={{ color: "var(--text-primary)" }}
            >
              {wallpaper.title}
            </h1>
            {wallpaper.description && wallpaper.description !== wallpaper.title && (
              <p className="text-sm leading-snug md:leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {wallpaper.description}
              </p>
            )}
          </div>

          <WallpaperStats
            width={wallpaper.width}
            height={wallpaper.height}
            format={wallpaper.format}
            likeCount={wallpaper.likeCount}
            downloadCount={wallpaper.downloadCount}
            createdAt={wallpaper.createdAt}
            fileSizeBytes={wallpaper.fileSizeBytes}
            layout="grid"
          />

          <ColorPalette palette={wallpaper.palette} />
          <WallpaperTags tags={wallpaper.tags} />
          <div className="pt-5 mt-1" style={{ borderTop: "1px solid var(--border)" }}>
            <AboutWallpaper wallpaper={wallpaper} category={category} extraCategories={extraCategories} />
            <div className="h-6" aria-hidden="true" />
        </div>
          <div className="h-6" aria-hidden="true" />
        </div>

        <div
          className="sticky bottom-0 z-20 mt-auto -mx-6 px-6 md:-mx-5 md:px-5 lg:-mx-8 lg:px-8 xl:-mx-10 xl:px-10 pt-4 pb-[max(16px,env(safe-area-inset-bottom))] md:pb-6 flex-shrink-0 border-t"
          style={{
            borderColor: "var(--border)",
            background: "var(--bg-primary)",
          }}
        >
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
            <div className="min-w-0 flex-1">
              <DownloadButton
                wallpaperId={wallpaper.id}
                fileUrl={wallpaper.fileUrl}
                title={wallpaper.title}
                dominantColor={wallpaper.dominantColor}
                contrastColor={contrastColor}
                fullWidth={true}
              />
            </div>
            <LikeButton
              wallpaperId={wallpaper.id}
              initialCount={wallpaper.likeCount}
              showCount={true}
              size="md"
              className="h-[52px] min-w-[52px] justify-center !px-3 sm:!px-4"
            />
            <BookmarkButton wallpaperId={wallpaper.id} size="md" variant="detail" className="h-[52px] w-[52px] justify-center" />
          </div>
        </div>
      </div>
    );
  }

  // landscape
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-8">
        <div className="flex flex-col gap-3">
          <div
            className="inline-block text-xs tracking-[0.3em] uppercase px-3 py-1 rounded-full w-fit"
            style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
          >
            Desktop Wallpaper
          </div>
          <h1
            className="text-3xl font-bold leading-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {wallpaper.title}
          </h1>
          {wallpaper.description && wallpaper.description !== wallpaper.title && (
            <p className="text-sm leading-relaxed max-w-lg" style={{ color: "var(--text-secondary)" }}>
              {wallpaper.description}
            </p>
          )}
        </div>

        {/* download + like top right */}
        <div className="flex items-center gap-3 flex-shrink-0 pt-1">
          <LikeButton
            wallpaperId={wallpaper.id}
            initialCount={wallpaper.likeCount}
            showCount={true}
            size="md"
            className="h-[52px] min-w-[52px] justify-center !px-4"
          />
          <BookmarkButton wallpaperId={wallpaper.id} size="md" variant="detail" className="h-[52px] w-[52px] justify-center" />
          <DownloadButton
            wallpaperId={wallpaper.id}
            fileUrl={wallpaper.fileUrl}
            title={wallpaper.title}
            dominantColor={wallpaper.dominantColor}
            contrastColor={contrastColor}
            fullWidth={false}
          />
        </div>
      </div>

      <WallpaperStats
        width={wallpaper.width}
        height={wallpaper.height}
        format={wallpaper.format}
        likeCount={wallpaper.likeCount}
        downloadCount={wallpaper.downloadCount}
        createdAt={wallpaper.createdAt}
        fileSizeBytes={wallpaper.fileSizeBytes}
        layout="row"
      />

      <div className="flex items-start gap-12">
        <ColorPalette palette={wallpaper.palette} />
        <WallpaperTags tags={wallpaper.tags} />
      </div>

      <AboutWallpaper wallpaper={wallpaper} category={category} extraCategories={extraCategories} />
    </div>
  );
};

export default WallpaperDetails;