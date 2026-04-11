import { Wallpaper } from "@aura/types";
import { getContrastColor } from "@/lib/color";
import WallpaperStats from "./WallpaperStats";
import ColorPalette from "./ColorPalette";
import WallpaperTags from "./WallpaperTags";
import DownloadButton from "./DownloadButton";
import LikeButton from "@/app/components/LikeButton";
import BookmarkButton from "@/app/components/BookmarkButton";

interface WallpaperDetailsProps {
  wallpaper: Wallpaper;
  statsLayout?: "row" | "grid";
}

const WallpaperDetails = ({
  wallpaper,
  statsLayout = "row",
}: WallpaperDetailsProps) => {
  const contrastColor = getContrastColor(wallpaper.dominantColor);
  const isPortrait = statsLayout === "grid";

  if (isPortrait) {
    return (
      <div className="flex min-h-0 flex-col md:h-full">
        <div className="flex min-h-0 flex-col gap-4 md:min-h-0 md:flex-1 md:overflow-y-auto md:overscroll-y-contain md:pr-1">
          <div
            className="inline-block text-xs tracking-[0.3em] uppercase px-3 py-1 rounded-full w-fit"
            style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
          >
            Mobile Wallpaper
          </div>

          <div>
            <h1
              className="text-xl font-bold leading-tight md:text-2xl mb-2 md:mb-3"
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
        </div>

        <div
          className="mt-6 flex-shrink-0 border-t pt-4 md:mt-4 md:border-t md:pt-4"
          style={{
            borderColor: "var(--border)",
            background: "var(--bg-primary)",
          }}
        >
          <div className="flex items-center gap-3 md:gap-4">
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
            />
            <BookmarkButton wallpaperId={wallpaper.id} size="md" variant="detail" />
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
        <div className="flex items-center gap-4 flex-shrink-0 pt-1">
          <LikeButton
            wallpaperId={wallpaper.id}
            initialCount={wallpaper.likeCount}
            showCount={true}
            size="md"
          />
          <BookmarkButton wallpaperId={wallpaper.id} size="md" variant="detail" />
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
    </div>
  );
};

export default WallpaperDetails;