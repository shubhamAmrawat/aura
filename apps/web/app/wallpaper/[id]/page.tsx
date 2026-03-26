import Image from "next/image";
import Link from "next/link";
import { getWallpaperById, getWallpapers } from "@/lib/api";
import { Wallpaper } from "@aura/types";
import WallpaperCard from "@/app/components/WallpaperCard";
import { getContrastColor } from "@/lib/color";
interface WallpaperPageProps {
  params: Promise<{ id: string }>;
}

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
    .slice(0, 5);

  const isPortrait = wallpaper.height > wallpaper.width;

  // ─── PORTRAIT LAYOUT ───────────────────────────────────────────────
  if (isPortrait) {
    return (
      <main
        className="min-h-screen"
        style={{ background: "var(--bg-primary)" }}
      >
        {/* back button */}
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

        {/* side by side layout */}
        <div className="flex pt-[72px]" style={{ minHeight: "100vh" }}>

          {/* left — wallpaper */}
          <div
            className="relative flex-shrink-0 flex items-center justify-center"
            style={{
              width: "55%",
              background: wallpaper.dominantColor,
              minHeight: "calc(100vh - 72px)",
            }}
          >
            {/* subtle dark overlay on dominant color bg */}
            <div
              className="absolute inset-0"
              style={{ background: "rgba(0,0,0,0.15)" }}
            />
            <div
              className="relative"
              style={{
                height: "calc(100vh - 72px - 48px)",
                aspectRatio: `${wallpaper.width} / ${wallpaper.height}`,
                maxWidth: "90%",
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

          {/* right — details */}
          <div
            className="flex flex-col justify-center px-12 py-12"
            style={{
              width: "45%",
              borderLeft: "1px solid var(--border)",
            }}
          >
            {/* tag */}
            <div
              className="inline-block text-xs tracking-[0.3em] uppercase mb-6 px-3 py-1 rounded-full w-fit"
              style={{
                background: "var(--accent-muted)",
                color: "var(--accent)",
              }}
            >
              Mobile Wallpaper
            </div>

            {/* title */}
            <h1
              className="text-3xl font-bold mb-3 leading-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {wallpaper.title}
            </h1>

            {wallpaper.description &&
              wallpaper.description !== wallpaper.title && (
                <p
                  className="text-sm leading-relaxed mb-8"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {wallpaper.description}
                </p>
              )}

            {/* stats */}
            <div
              className="grid grid-cols-2 gap-6 py-8"
              style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}
            >
              <div>
                <p
                  className="text-xs uppercase tracking-widest mb-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  Resolution
                </p>
                <p
                  className="text-sm font-mono"
                  style={{ color: "var(--text-primary)" }}
                >
                  {wallpaper.width} × {wallpaper.height}
                </p>
              </div>
              <div>
                <p
                  className="text-xs uppercase tracking-widest mb-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  Format
                </p>
                <p
                  className="text-sm font-mono uppercase"
                  style={{ color: "var(--text-primary)" }}
                >
                  {wallpaper.format}
                </p>
              </div>
              <div>
                <p
                  className="text-xs uppercase tracking-widest mb-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  Likes
                </p>
                <p
                  className="text-sm font-mono"
                  style={{ color: "var(--text-primary)" }}
                >
                  {wallpaper.likeCount}
                </p>
              </div>
              <div>
                <p
                  className="text-xs uppercase tracking-widest mb-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  Downloads
                </p>
                <p
                  className="text-sm font-mono"
                  style={{ color: "var(--text-primary)" }}
                >
                  {wallpaper.downloadCount}
                </p>
              </div>
            </div>

            {/* palette */}
            <div className="py-8" style={{ borderBottom: "1px solid var(--border)" }}>
              <p
                className="text-xs uppercase tracking-widest mb-3"
                style={{ color: "var(--text-muted)" }}
              >
                Color Palette
              </p>
              <div className="flex gap-3">
                {wallpaper.palette.map((color: string, i: number) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border"
                    style={{
                      backgroundColor: color,
                      borderColor: "var(--border)",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* download */}
            <div className="pt-8">
              <button
                className="w-full flex items-center justify-center gap-3 px-8 py-4 rounded-full text-sm font-medium tracking-wider transition-opacity hover:opacity-80"
                style={{
                 background: wallpaper.dominantColor,
                  color: getContrastColor(wallpaper.dominantColor),
                  
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download Free
              </button>
            </div>
          </div>
        </div>

        {/* similar wallpapers */}
        <div
          className="px-12 py-16"
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
              <p
                className="text-xs mt-1"
                style={{ color: "var(--text-secondary)" }}
              >
                You might also like
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {others?.map((w: Wallpaper) => (
                <WallpaperCard key={w.id} wallpaper={w} />
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ─── LANDSCAPE LAYOUT ──────────────────────────────────────────────
  return (
    <main
      className="min-h-screen"
      style={{ background: "var(--bg-primary)" }}
    >
      {/* back button */}
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

      {/* full bleed image */}
      <div
        className="relative w-full pt-[72px]"
        style={{ height: "100vh" }}
      >
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
              "linear-gradient(to top, rgba(10,10,10,0.9) 0%, transparent 50%)",
          }}
        />
      </div>

      {/* details below */}
      <div
        className="w-full px-12 py-12"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-start justify-between gap-12">
            <div className="flex-1">
              <div
                className="inline-block text-xs tracking-[0.3em] uppercase mb-4 px-3 py-1 rounded-full"
                style={{
                  background: "var(--accent-muted)",
                  color: "var(--accent)",
                }}
              >
                Desktop Wallpaper
              </div>
              <h1
                className="text-3xl font-bold mb-3 leading-tight"
                style={{ color: "var(--text-primary)" }}
              >
                {wallpaper.title}
              </h1>
              {wallpaper.description &&
                wallpaper.description !== wallpaper.title && (
                  <p
                    className="text-sm leading-relaxed mb-8 max-w-lg"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {wallpaper.description}
                  </p>
                )}
              <div className="flex items-center gap-8 mt-6">
                <div>
                  <p className="text-xs uppercase tracking-widest mb-1"
                    style={{ color: "var(--text-muted)" }}>Resolution</p>
                  <p className="text-sm font-mono"
                    style={{ color: "var(--text-primary)" }}>
                    {wallpaper.width} × {wallpaper.height}
                  </p>
                </div>
                <div className="w-px h-8" style={{ background: "var(--border)" }} />
                <div>
                  <p className="text-xs uppercase tracking-widest mb-1"
                    style={{ color: "var(--text-muted)" }}>Format</p>
                  <p className="text-sm font-mono uppercase"
                    style={{ color: "var(--text-primary)" }}>
                    {wallpaper.format}
                  </p>
                </div>
                <div className="w-px h-8" style={{ background: "var(--border)" }} />
                <div>
                  <p className="text-xs uppercase tracking-widest mb-1"
                    style={{ color: "var(--text-muted)" }}>Likes</p>
                  <p className="text-sm font-mono"
                    style={{ color: "var(--text-primary)" }}>
                    {wallpaper.likeCount}
                  </p>
                </div>
                <div className="w-px h-8" style={{ background: "var(--border)" }} />
                <div>
                  <p className="text-xs uppercase tracking-widest mb-1"
                    style={{ color: "var(--text-muted)" }}>Downloads</p>
                  <p className="text-sm font-mono"
                    style={{ color: "var(--text-primary)" }}>
                    {wallpaper.downloadCount}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-6 pt-2">
              <div className="flex flex-col items-end gap-2">
                <p className="text-xs uppercase tracking-widest"
                  style={{ color: "var(--text-muted)" }}>
                  Color Palette
                </p>
                <div className="flex gap-2">
                  {wallpaper.palette.map((color: string, i: number) => (
                    <div
                      key={i}
                      className="w-7 h-7 rounded-full border"
                      style={{
                        backgroundColor: color,
                        borderColor: "var(--border)",
                      }}
                    />
                  ))}
                </div>
              </div>
              <button
                className="flex items-center gap-3 px-8 py-3 rounded-full text-sm font-medium tracking-wider transition-opacity hover:opacity-80"
                style={{
                   background: wallpaper.dominantColor,
                  color: getContrastColor(wallpaper.dominantColor),
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download Free
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* similar */}
      <div className="px-12 pb-16">
        <div className="max-w-[1400px] mx-auto">
          <div className="mb-8">
            <h2 className="text-base font-semibold tracking-[0.15em] uppercase"
              style={{ color: "var(--text-primary)" }}>
              More Wallpapers
            </h2>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
              You might also like
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {others?.map((w: Wallpaper) => (
              <WallpaperCard key={w.id} wallpaper={w} />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}