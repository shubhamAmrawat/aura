"use client";

import { useState } from "react";
import Image from "next/image";
import { Image as ImageIcon, LayoutGrid, Lock } from "lucide-react";
import { PhonePreview } from "@/app/upload/DevicePreview";

type View = "wallpaper" | "lock" | "home";

const VIEWS: { id: View; label: string; Icon: typeof Lock }[] = [
  { id: "wallpaper", label: "Wallpaper", Icon: ImageIcon },
  { id: "lock", label: "Lock screen", Icon: Lock },
  { id: "home", label: "Home screen", Icon: LayoutGrid },
];

/**
 * The portrait / square wallpaper on its own, or on a phone's lock or home screen.
 * Sized with container units so the picture (and its rounded corners) always fits the panel.
 */
export function PhoneScreenPreview({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) {
  const [view, setView] = useState<View>("wallpaper");
  const ratio = width / height;
  // phone frame used by the upload page: 286 × 590
  const phoneRatio = 286 / 590;

  return (
    <div className="relative w-full h-full flex flex-col px-6 pt-16 pb-6 md:px-12 md:pt-20 md:pb-10">
      <div
        role="group"
        aria-label="Preview"
        className="absolute top-4 right-4 md:top-5 md:right-6 z-10 flex gap-1 p-1 rounded-full border border-white/10 bg-black/45 backdrop-blur-md"
      >
        {VIEWS.map(({ id, label, Icon }) => {
          const on = view === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              aria-label={label}
              title={label}
              onClick={() => setView(id)}
              className="h-8 px-2.5 sm:px-3 rounded-full inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors"
              style={on ? { background: "#f5f0eb", color: "#0a0a0a" } : { color: "#e5e5e5" }}
            >
              <Icon size={14} strokeWidth={2} aria-hidden="true" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 w-full flex items-center justify-center" style={{ containerType: "size" }}>
        {view === "wallpaper" ? (
          <div
            className="relative rounded-2xl overflow-hidden"
            style={{
              aspectRatio: `${width} / ${height}`,
              width: `min(100cqw, calc(100cqh * ${ratio}))`,
              boxShadow: "0 30px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08)",
            }}
          >
            <Image src={src} alt={alt} fill sizes="(max-width: 768px) 90vw, 50vw" className="object-cover" priority />
          </div>
        ) : (
          <PhonePreview src={src} screen={view} width={`min(300px, 100cqw, calc(100cqh * ${phoneRatio}))`} />
        )}
      </div>
    </div>
  );
}
