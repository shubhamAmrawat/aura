"use client";

import { Wallpaper } from "@aura/types";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { getContrastColor } from "@/lib/color";

interface HeroProps {
  wallpapers: Wallpaper[];
}

const SWIPE_MIN_PX = 50;
const SWIPE_CLICK_GUARD_MS = 450;

const Hero = ({ wallpapers }: HeroProps) => {
  const [current, setCurrent] = useState(0);
  const [hovered, setHovered] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastHorizontalSwipeAt = useRef(0);

  useEffect(() => {
    if (wallpapers.length === 0) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % wallpapers.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [wallpapers.length]);

  const wallpaper = wallpapers[current];

  if (!wallpaper) return null;

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    if (!t) return;
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  }

  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || wallpapers.length < 2) return;

    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX < SWIPE_MIN_PX || absX <= absY) return;

    lastHorizontalSwipeAt.current = Date.now();
    if (dx < 0) setCurrent((c) => (c + 1) % wallpapers.length);
    else setCurrent((c) => (c - 1 + wallpapers.length) % wallpapers.length);
  }

  function onSlideLinkClick(ev: React.MouseEvent<HTMLAnchorElement>) {
    if (Date.now() - lastHorizontalSwipeAt.current < SWIPE_CLICK_GUARD_MS) {
      ev.preventDefault();
    }
  }

  return (
    <div
      className="relative w-full h-[90vh] overflow-hidden cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {wallpapers.map((w, i) => (
        <Link
          key={w.id}
          href={`/wallpaper/${w.id}`}
          onClick={onSlideLinkClick}
          className={`absolute inset-0 block transition-opacity duration-[2000ms] ease-in-out ${
            i === current
              ? "z-[2] opacity-100 pointer-events-auto"
              : "z-[1] opacity-0 pointer-events-none"
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
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/0 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-l from-[#0a0a0a]/10 to-transparent" />
        </Link>
      ))}

      {/* bottom right details */}
      <div
        className={`pointer-events-none absolute bottom-16 right-12 z-10 max-w-sm text-right transition-all duration-500 ${
          hovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        {/* <p className="text-[11px] tracking-[0.3em] uppercase mb-2 text-white/40">
          Featured Wallpaper
        </p> */}
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
        <Link
          href={`/wallpaper/${wallpaper.id}`}
          className="pointer-events-auto mt-2 inline-flex items-center justify-center px-6 py-2.5 text-sm rounded-full border border-white/10 transition-opacity hover:opacity-90 cursor-pointer"
          style={{
            backgroundColor: wallpaper.dominantColor,
            color: getContrastColor(wallpaper.dominantColor),
          }}
        >
          View Details →
        </Link>
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