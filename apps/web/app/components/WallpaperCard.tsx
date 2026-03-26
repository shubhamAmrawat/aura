"use client"

import { Wallpaper } from "@aura/types"
import { useState } from "react";


interface WallpaperCardProps{
  wallpaper: Wallpaper;
}

const WallpaperCard = ({ wallpaper }: WallpaperCardProps) => {
  const [hovered, setHovered] = useState(false); 
  return (
    <div
      className="relative aspect-[3/4] rounded-xl overflow-hidden cursor-pointer group"
      style={{ backgroundColor: wallpaper.dominantColor }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* wallpaper image */}
      <img
        src={wallpaper.fileUrl}
        alt={wallpaper.title}
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
      />

      {/* hover overlay */}
      <div
        className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-opacity duration-300 ${
          hovered ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <p className="text-white font-medium text-sm line-clamp-1 mb-1">
            {wallpaper.title}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-white/50 text-xs">
              {wallpaper.width} × {wallpaper.height}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-white/50 text-xs">
                ♥ {wallpaper.likeCount}
              </span>
              <button className="text-xs bg-white text-black px-3 py-1 rounded-full font-medium hover:bg-white/90 transition-colors">
                Download
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WallpaperCard