"use client";

import { Wallpaper } from "@aura/types";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/authContext";
import { useRouter } from "next/navigation";
import { toggleLike } from "@/lib/likesApi";

interface WallpaperCardProps {
  wallpaper: Wallpaper;
}

const DownloadIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const WallpaperCard = ({ wallpaper }: WallpaperCardProps) => {
  const [hovered, setHovered] = useState(false);
  const [localLiked, setLocalLiked] = useState<boolean | null>(null);
  const [likeCount, setLikeCount] = useState(wallpaper.likeCount);
  const [ripple, setRipple] = useState(false);

  const { user, token, likedIds, toggleLikedId } = useAuth();
  const router = useRouter();

  // derive liked from local override or global context
  const liked = localLiked !== null ? localLiked : likedIds.has(wallpaper.id);

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user || !token) {
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
      const data = await toggleLike(wallpaper.id, token);
      setLocalLiked(data.liked);
      if (data.liked !== newLiked) {
        toggleLikedId(wallpaper.id);
      }
    } catch {
      setLocalLiked(!newLiked);
      setLikeCount((prev) => newLiked ? prev - 1 : prev + 1);
      toggleLikedId(wallpaper.id);
    }
  };

  return (
    <Link href={`/wallpaper/${wallpaper.id}`}>
      <div
        className="relative aspect-[3/4] rounded-2xl overflow-hidden cursor-pointer group"
        style={{ backgroundColor: wallpaper.dominantColor }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* image */}
        <Image
          src={wallpaper.fileUrl}
          alt={wallpaper.title}
          fill
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
          loading="lazy"
        />

        {/* like button — top right */}
        <div
          className="absolute top-3 right-3 z-10 transition-all duration-200"
          style={{
            opacity: hovered ? 1 : 0,
            transform: hovered ? "translateY(0)" : "translateY(-6px)",
          }}
        >
          <button
            onClick={handleLike}
            className="relative flex items-center justify-center w-8 h-8 rounded-full"
            style={{
              background: liked ? "rgba(239,68,68,0.9)" : "rgba(0,0,0,0.5)",
              border: liked
                ? "1px solid rgba(239,68,68,0.4)"
                : "1px solid rgba(255,255,255,0.12)",
              backdropFilter: "blur(8px)",
              transition: "background 0.25s ease, border 0.25s ease",
            }}
          >
            {/* ripple */}
            {ripple && (
              <span
                className="absolute inset-0 rounded-full"
                style={{
                  background: "rgba(239,68,68,0.4)",
                  animation: "ripple 0.6s ease-out forwards",
                }}
              />
            )}

            {/* heart */}
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill={liked ? "white" : "none"}
              stroke={liked ? "white" : "rgba(255,255,255,0.85)"}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transition: "transform 0.2s ease",
                transform: ripple ? "scale(0.85)" : "scale(1)",
              }}
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        </div>

        {/* hover overlay */}
        <div
          className={`absolute inset-0 transition-opacity duration-300 ${hovered ? "opacity-100" : "opacity-0"}`}
          style={{
            background: "linear-gradient(to top, rgba(0,0,0,0.90) 0%, rgba(0,0,0,0.3) 55%, transparent 100%)"
          }}
        >
          <div
            className="absolute bottom-0 left-0 right-0"
            style={{ padding: "32px 16px 16px 16px" }}
          >
            <p
              className="text-sm font-medium line-clamp-2 mb-2 leading-snug"
              style={{ color: "var(--text-primary)" }}
            >
              {wallpaper.title}
            </p>
            <p
              className="text-xs font-mono mb-3"
              style={{ color: "var(--text-muted)" }}
            >
              {wallpaper.width} × {wallpaper.height}
            </p>
            <div className="flex items-center gap-4">
              <div
                className="flex items-center gap-1.5"
                style={{ color: liked ? "#ef4444" : "var(--text-secondary)" }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24"
                  fill={liked ? "currentColor" : "none"}
                  stroke="currentColor" strokeWidth="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                <span className="text-xs">{likeCount}</span>
              </div>
              <div
                className="flex items-center gap-1.5"
                style={{ color: "var(--accent)" }}
              >
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