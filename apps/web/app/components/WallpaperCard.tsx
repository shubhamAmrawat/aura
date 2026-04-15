"use client";

import { Wallpaper } from "@aura/types";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/authContext";
import { useRouter } from "next/navigation";
import { toggleLike } from "@/lib/likesApi";
import BookmarkButton from "@/app/components/BookmarkButton";
import { decode } from "blurhash";

interface WallpaperCardProps {
  wallpaper: Wallpaper;
  priority?: boolean;
}

// Decode blurhash on the idle thread so it never blocks scroll/paint frames.
function decodeBlurhashWhenIdle(
  hash: string,
  onReady: (dataURL: string) => void,
): () => void {
  let cancelled = false;
  const schedule =
    typeof window !== "undefined" && "requestIdleCallback" in window
      ? (cb: () => void) => requestIdleCallback(cb, { timeout: 3000 })
      : (cb: () => void) => setTimeout(cb, 200);

  schedule(() => {
    if (cancelled) return;
    try {
      const W = 32, H = 32;
      const pixels = decode(hash, W, H);
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const imageData = ctx.createImageData(W, H);
      imageData.data.set(pixels);
      ctx.putImageData(imageData, 0, 0);
      if (!cancelled) onReady(canvas.toDataURL());
    } catch {
      // ignore — dominantColor background is already visible
    }
  });

  return () => { cancelled = true; };
}

const DownloadIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const WallpaperCard = ({ wallpaper, priority = false }: WallpaperCardProps) => {
  const [localLiked, setLocalLiked] = useState<boolean | null>(null);
  const [likeCount, setLikeCount] = useState(wallpaper.likeCount);
  const [ripple, setRipple] = useState(false);
  const [blurDataURL, setBlurDataURL] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  const cancelBlurhashRef = useRef<(() => void) | null>(null);

  const { user, likedIds, toggleLikedId } = useAuth();
  const router = useRouter();

  const liked = localLiked !== null ? localLiked : likedIds.has(wallpaper.id);

  // Decode blurhash only when the browser is idle — never on the critical scroll path.
  useEffect(() => {
    if (!wallpaper.blurhash) return;
    cancelBlurhashRef.current = decodeBlurhashWhenIdle(wallpaper.blurhash, (url) => {
      setBlurDataURL(url);
    });
    return () => cancelBlurhashRef.current?.();
  }, [wallpaper.blurhash]);

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      router.push("/login");
      return;
    }

    setRipple(true);
    setTimeout(() => setRipple(false), 600);

    const newLiked = !liked;
    setLocalLiked(newLiked);
    setLikeCount((prev) => newLiked ? prev + 1 : prev - 1);
    toggleLikedId(wallpaper.id);

    try {
      const data = await toggleLike(wallpaper.id);
      setLocalLiked(data.liked);
      if (data.liked !== newLiked) toggleLikedId(wallpaper.id);
    } catch {
      setLocalLiked(!newLiked);
      setLikeCount((prev) => newLiked ? prev - 1 : prev + 1);
      toggleLikedId(wallpaper.id);
    }
  };

  // aspect ratio from actual dimensions — prevents layout shift
  const aspectRatio = wallpaper.width && wallpaper.height
    ? wallpaper.width / wallpaper.height
    : 3 / 4;

  return (
    <Link href={`/wallpaper/${wallpaper.id}`}>
      {/*
        will-change: transform  → promotes card to its own GPU compositor layer so
        hover transforms never trigger a full-page repaint.
        contain: layout style paint → isolates layout recalcs to this subtree.
      */}
      <div
        className="relative rounded-2xl overflow-hidden cursor-pointer group"
        style={{
          backgroundColor: wallpaper.dominantColor || "#1a1a1a",
          willChange: "transform",
          contain: "layout style paint",
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* aspect ratio container — reserves exact space before image loads */}
        <div style={{ paddingBottom: `${(1 / aspectRatio) * 100}%`, position: "relative" }}>

          {/* blurhash placeholder — shows while image loads (decoded off main thread) */}
          {blurDataURL && !loaded && (
            <img
              src={blurDataURL}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover"
              style={{ filter: "blur(8px)", transform: "scale(1.05)" }}
            />
          )}

          <Image
            src={wallpaper.fileUrl}
            alt={wallpaper.title}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
            className="object-cover"
            style={{
              opacity: loaded ? 1 : 0,
              transition: "opacity 0.4s ease",
            }}
            loading={priority ? "eager" : "lazy"}
            priority={priority}
            onLoad={() => setLoaded(true)}
          />
        </div>

        {/*
          Top-right action buttons.
          CSS-only visibility: no JS state, no React re-renders on hover.
          opacity + translateY are both compositor-only properties — no layout triggered.
        */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 opacity-0 -translate-y-1.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200">
          <BookmarkButton wallpaperId={wallpaper.id} size="sm" variant="card" />

          <button
            onClick={handleLike}
            aria-label={liked ? "Unlike wallpaper" : "Like wallpaper"}
            className="relative flex items-center justify-center w-8 h-8 rounded-full"
            style={{
              background: liked ? "rgba(239,68,68,0.9)" : "rgba(0,0,0,0.5)",
              border: liked ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(255,255,255,0.12)",
              backdropFilter: "blur(6px)",
              transition: "background 0.25s ease, border 0.25s ease",
            }}
          >
            {ripple && (
              <span
                className="absolute inset-0 rounded-full"
                style={{ background: "rgba(239,68,68,0.4)", animation: "ripple 0.6s ease-out forwards" }}
              />
            )}
            <svg
              width="13" height="13" viewBox="0 0 24 24"
              fill={liked ? "white" : "none"}
              stroke={liked ? "white" : "rgba(255,255,255,0.85)"}
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transition: "transform 0.2s ease", transform: ripple ? "scale(0.85)" : "scale(1)" }}
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        </div>

        {/* Hover overlay — CSS-only, compositor-friendly opacity transition */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.90) 0%, rgba(0,0,0,0.3) 55%, transparent 100%)" }}
        >
          <div className="absolute bottom-0 left-0 right-0" style={{ padding: "32px 16px 16px 16px" }}>
            <p className="text-sm font-medium line-clamp-2 mb-2 leading-snug" style={{ color: "var(--text-primary)" }}>
              {wallpaper.title}
            </p>
            <p className="text-xs font-mono mb-3" style={{ color: "var(--text-muted)" }}>
              {wallpaper.width} × {wallpaper.height}
            </p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5" style={{ color: liked ? "#ef4444" : "var(--text-secondary)" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                <span className="text-xs">{likeCount}</span>
              </div>
              <div className="flex items-center gap-1.5" style={{ color: "var(--accent)" }}>
                <DownloadIcon />
                <span className="text-xs">{wallpaper.downloadCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default WallpaperCard;