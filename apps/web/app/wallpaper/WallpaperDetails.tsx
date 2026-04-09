import { Wallpaper } from "@aura/types";
import { getContrastColor } from "@/lib/color";
import WallpaperStats from "./WallpaperStats";
import ColorPalette from "./ColorPalette";
import WallpaperTags from "./WallpaperTags";
import DownloadButton from "./DownloadButton";
import LikeButton from "@/app/components/LikeButton";

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
      <div className="flex flex-col gap-8">
        <div
          className="inline-block text-xs tracking-[0.3em] uppercase px-3 py-1 rounded-full w-fit"
          style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
        >
          Mobile Wallpaper
        </div>

        <div>
          <h1
            className="text-2xl font-bold mb-3 leading-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {wallpaper.title}
          </h1>
          {wallpaper.description && wallpaper.description !== wallpaper.title && (
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
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

        {/* download + like row */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
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