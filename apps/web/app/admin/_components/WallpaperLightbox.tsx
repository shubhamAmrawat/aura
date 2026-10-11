"use client";

import { useEffect, useState } from "react";
import { resolutionOf } from "@/lib/adminApi";

export type LightboxWallpaper = {
  fileUrl: string;
  title: string;
  width: number;
  height: number;
  format: string;
  tags: string[];
  dominantColor: string;
};

type Frame = "original" | "phone" | "desktop";

/** Full-screen image preview with optional phone / desktop frames. Esc, ✕ or backdrop click closes. */
export default function WallpaperLightbox({ wallpaper: w, onClose }: { wallpaper: LightboxWallpaper; onClose: () => void }) {
  const [frame, setFrame] = useState<Frame>("original");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    };
    // capture so it closes before any drawer underneath reacts
    window.addEventListener("keydown", onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const res = resolutionOf(w.width, w.height);
  const frames: { v: Frame; label: string }[] = [
    { v: "original", label: "Original" },
    { v: "phone", label: "Phone" },
    { v: "desktop", label: "Desktop" },
  ];

  const img = (className: string, style?: React.CSSProperties) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={w.fileUrl} alt={w.title} onLoad={() => setLoaded(true)} className={className} style={style} draggable={false} />
  );

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col"
      style={{ background: "rgba(0,0,0,0.88)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview: ${w.title}`}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 px-4 md:px-6 h-14 shrink-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex rounded-lg p-0.5 gap-0.5" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
          {frames.map((f) => (
            <button
              key={f.v}
              onClick={() => setFrame(f.v)}
              className="px-3 py-1.5 rounded-md text-xs transition-colors"
              style={{
                background: frame === f.v ? "rgba(255,255,255,0.14)" : "transparent",
                color: frame === f.v ? "#fff" : "rgba(255,255,255,0.6)",
                fontWeight: frame === f.v ? 600 : 400,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10" style={{ color: "#fff" }} aria-label="Close preview">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>

      {/* Stage */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-4 md:px-8">
        <div onClick={(e) => e.stopPropagation()} className="relative flex items-center justify-center max-h-full">
          {!loaded && <div className="absolute inset-0 m-auto w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(255,255,255,0.2)", borderTopColor: "var(--accent)" }} />}

          {frame === "original" && img("max-h-[calc(100vh-150px)] max-w-[92vw] object-contain rounded-lg", { background: w.dominantColor })}

          {frame === "phone" && (
            <div className="relative rounded-[42px]" style={{ background: "#111", boxShadow: "0 0 0 2px #2a2a2a, 0 24px 64px rgba(0,0,0,0.6)", height: "min(calc(100vh - 170px), 760px)", aspectRatio: "9 / 19.5" }}>
              {img("absolute inset-[10px] w-[calc(100%-20px)] h-[calc(100%-20px)] object-cover rounded-[32px]", { background: w.dominantColor })}
              <span className="absolute top-[18px] left-1/2 -translate-x-1/2 w-24 h-6 rounded-full" style={{ background: "#000" }} />
              <span className="absolute bottom-[18px] left-1/2 -translate-x-1/2 w-28 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.55)" }} />
            </div>
          )}

          {frame === "desktop" && (
            <div className="flex flex-col items-center">
              <div className="relative rounded-xl" style={{ background: "#111", boxShadow: "0 0 0 2px #2a2a2a, 0 24px 64px rgba(0,0,0,0.6)", width: "min(88vw, calc((100vh - 230px) * 16 / 9), 1200px)", aspectRatio: "16 / 9" }}>
                {img("absolute inset-[10px] w-[calc(100%-20px)] h-[calc(100%-20px)] object-cover rounded-md", { background: w.dominantColor })}
              </div>
              <div className="w-24 h-10" style={{ background: "linear-gradient(#1c1c1c, #141414)", clipPath: "polygon(25% 0, 75% 0, 85% 100%, 15% 100%)" }} />
              <div className="w-48 h-2 rounded-full" style={{ background: "#1c1c1c" }} />
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="shrink-0 px-4 md:px-6 py-3 text-center" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-medium" style={{ color: "#fff" }}>{w.title}</p>
        <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.6)" }}>
          {w.width}×{w.height} · {res.label} · {w.format.toUpperCase()}
          {w.tags.length > 0 && <> · {w.tags.slice(0, 8).join(", ")}{w.tags.length > 8 ? "…" : ""}</>}
        </p>
      </div>
    </div>
  );
}
