"use client";

import { Wallpaper } from "@aura/types";
import { useState, useEffect } from "react";
import Image from "next/image";

interface HeroProps {
  wallpapers: Wallpaper[];
}

const Hero = ({ wallpapers }: HeroProps) => {
  const [current, setCurrent] = useState(0);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % wallpapers.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [wallpapers.length]);

  const wallpaper = wallpapers[current];

  if (!wallpaper) return null;

  return (
    <div
      className="relative w-full h-[90vh] overflow-hidden cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {wallpapers.map((w, i) => (
        <div
          key={w.id}
          className={`absolute inset-0 transition-opacity duration-[2000ms] ease-in-out ${
            i === current ? "opacity-100" : "opacity-0"
          }`}
        >
          <Image
            src={w.fileUrl}
            alt={w.title}
            fill
            sizes="100vw"
            className="object-cover"
            priority={i === 0}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/20 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-l from-[#0a0a0a]/60 to-transparent" />
        </div>
      ))}

      {/* bottom right details */}
      <div
        className={`absolute bottom-16 right-12 z-10 max-w-sm text-right transition-all duration-500 ${
          hovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        <p className="text-[11px] tracking-[0.3em] uppercase mb-2 text-white/40">
          Featured Wallpaper
        </p>
        <h2 className="text-[22px] font-bold leading-snug mb-2 text-white">
          {wallpaper.title}
        </h2>
        <div className="flex items-center justify-end gap-4 mb-3">
          <span className="text-xs font-mono text-white/40">
            {wallpaper.width} × {wallpaper.height}
          </span>
          <span className="text-xs text-white/40">
            ♥ {wallpaper.likeCount}
          </span>
        </div>
        <div className="flex justify-end gap-2 mb-2">
          {wallpaper.palette.map((color, i) => (
            <div
              key={i}
              className="w-3.5 h-3.5 rounded-full border border-white/20"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <button className="mt-2 px-6 py-2.5 border border-white/20 text-white/70 text-sm rounded-full hover:border-white/50 hover:text-white transition-all bg-transparent cursor-pointer">
          View Details →
        </button>
      </div>

      {/* indicators */}
      <div className="absolute bottom-8 left-12 z-10 flex flex-col gap-3">
        <p className="text-[11px] font-mono tracking-[0.2em] text-white/30">
          {String(current + 1).padStart(2, "0")} / {String(wallpapers.length).padStart(2, "0")}
        </p>
        <div className="flex gap-2 items-center">
          {wallpapers.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-0.5 rounded-full border-none cursor-pointer transition-all duration-500 ${
                i === current
                  ? "w-10 bg-white"
                  : "w-4 bg-white/25 hover:bg-white/50"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Hero;