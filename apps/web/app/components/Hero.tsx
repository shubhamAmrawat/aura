"use client";

import { Wallpaper } from "@aura/types";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { SunIcon } from "lucide-react";
import { getContrastColor } from "@/lib/color";
import type { DailyWallpaper } from "@/lib/api";

interface HeroProps {
  wallpapers: Wallpaper[];
  /** Today's wallpaper of the day: shown first, with its label always on screen. */
  daily?: DailyWallpaper | null;
}

const SWIPE_MIN_PX = 50;
const SWIPE_CLICK_GUARD_MS = 450;

const Hero = ({ wallpapers: featured, daily }: HeroProps) => {
  // the daily pick first (and not twice if it's also featured), then the featured ones in admin order
  const wallpapers = daily ? [daily, ...featured.filter((w) => w.id !== daily.id)] : featured;
  const isDaily = (i: number) => !!daily && i === 0;
  const [current, setCurrent] = useState(0);
  const [hovered, setHovered] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastHorizontalSwipeAt = useRef(0);
  const scrollingRef = useRef(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pause autoplay while the user is scrolling — the hero is off-screen anyway
  // and the 2 s CSS crossfade creates unnecessary compositor work during scroll.
  useEffect(() => {
    const onScroll = () => {
      scrollingRef.current = true;
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = setTimeout(() => {
        scrollingRef.current = false;
      }, 300);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (wallpapers.length === 0) return;
    const timer = setInterval(() => {
      if (scrollingRef.current) return;
      setCurrent((prev) => (prev + 1) % wallpapers.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [wallpapers.length]);

  const wallpaper = wallpapers[current];
  const dailyShown = isDaily(current);

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
          style={{ willChange: "opacity" }}
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
          {wallpaper.likeCount > 0 && (
            <span className="text-xs text-white/40">
              ♥ {wallpaper.likeCount}
            </span>
          )}
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
        {/* wallpaper of the day: its badge instead of the count; featured slides: "01 / 06" (featured only) */}
        <div className="h-8 flex items-end">
          {dailyShown ? (
            <span
              className="inline-flex items-center gap-2 h-8 pl-2.5 pr-3.5 rounded-full text-[13px] font-bold text-white"
              style={{ background: "rgba(10,10,10,0.55)", border: "1px solid rgba(255,255,255,0.14)", backdropFilter: "blur(10px)" }}
            >
              <SunIcon size={15} strokeWidth={2.4} color="#FACC15" aria-hidden="true" />
              Wallpaper of the day
            </span>
          ) : (
            <p className="text-[11px] font-mono tracking-[0.2em] text-white/30">
              {String(current - (daily ? 1 : 0) + 1).padStart(2, "0")} / {String(wallpapers.length - (daily ? 1 : 0)).padStart(2, "0")}
            </p>
          )}
        </div>
        {/* each bar sits in a 24px-tall button, so it's easy to hit; the sun is a button for slide 1 */}
        <div className="flex items-center -ml-1.5">
          {daily && (
            <button
              type="button"
              onClick={() => setCurrent(0)}
              aria-label="Go to the wallpaper of the day"
              className="group w-6 h-6 flex items-center justify-center rounded-full cursor-pointer hover:bg-white/10"
            >
              <SunIcon size={14} strokeWidth={2.6} color="#FACC15" aria-hidden="true" className="transition-transform group-hover:scale-110" />
            </button>
          )}
          {wallpapers.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrent(i)}
              aria-label={isDaily(i) ? "Go to the wallpaper of the day" : `Go to slide ${i + 1}`}
              aria-current={i === current ? "true" : undefined}
              className="group h-6 px-1 flex items-center cursor-pointer"
            >
              <span
                className={`block h-0.5 rounded-full transition-all duration-500 ${
                  i === current ? "w-10 bg-white" : "w-4 bg-white/25 group-hover:bg-white/60"
                }`}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Hero;