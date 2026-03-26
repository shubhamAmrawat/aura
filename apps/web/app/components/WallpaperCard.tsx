"use client";

import { Wallpaper } from "@aura/types";
import { useState } from "react";
import Image from "next/image";

interface WallpaperCardProps {
  wallpaper: Wallpaper;
}

const DownloadIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const HeartIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
);

const WallpaperCard = ({ wallpaper }: WallpaperCardProps) => {
  const [hovered, setHovered] = useState(false);

  return (
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

      {/* hover overlay */}
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${
          hovered ? "opacity-100" : "opacity-0"
        }`}
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.90) 0%, rgba(0,0,0,0.3) 55%, transparent 100%)'
        }}
      >
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{ padding: '32px 16px 16px 16px' }}
        >
          <p
            className="text-sm font-medium line-clamp-2 mb-2 leading-snug"
            style={{ color: 'var(--text-primary)' }}
          >
            {wallpaper.title}
          </p>
          <p
            className="text-xs font-mono mb-3"
            style={{ color: 'var(--text-muted)' }}
          >
            {wallpaper.width} × {wallpaper.height}
          </p>
          <div className="flex items-center gap-4">
            <div
              className="flex items-center gap-1.5"
              style={{ color: 'var(--text-secondary)' }}
            >
              <HeartIcon />
              <span className="text-xs">{wallpaper.likeCount}</span>
            </div>
            <div
              className="flex items-center gap-1.5"
              style={{ color: 'var(--accent)' }}
            >
              <DownloadIcon />
              <span className="text-xs">{wallpaper.downloadCount}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WallpaperCard;