"use client";

import { useState } from "react";
import { Share2Icon } from "lucide-react";
import { endsInLabel, tint, type DropPreviewItem } from "@/lib/drops";

export type DropInfo = {
  status: "live" | "ended";
  startsAt: string | null;
  endsAt: string | null;
  accentColor: string;
  preview: DropPreviewItem[];
};

/** Header of a drop's page (/collection/:id for kind = drop): made from the drop's own wallpapers. */
export default function DropHero({ title, description, count, drop }: { title: string; description: string | null; count: number; drop: DropInfo }) {
  const [copied, setCopied] = useState(false);
  const [first, second, third] = drop.preview;
  const accent = drop.accentColor;
  const ends = drop.status === "live" ? endsInLabel(drop.endsAt) : null;
  const pill = drop.status === "ended" ? "Drop ended" : `Limited drop${ends ? ` · ${ends}` : ""}`;
  const img = (w?: DropPreviewItem) => w?.thumbUrl ?? w?.fileUrl;

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) { await navigator.share({ title, url }); return; }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* cancelled */ }
  };

  return (
    <header className="relative overflow-hidden rounded-[28px] mb-10" style={{ border: `1px solid ${tint(accent, 0.25)}` }}>
      {first && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img(first)} alt="" aria-hidden="true" className="absolute -inset-10 w-[calc(100%+80px)] h-[calc(100%+80px)] max-w-none object-cover" style={{ filter: "blur(30px) brightness(.45) saturate(1.35)" }} />
      )}
      <div aria-hidden="true" className="absolute inset-0" style={{ background: `radial-gradient(55% 90% at 75% 50%, ${tint(accent, 0.3)}, rgba(0,0,0,0) 70%), linear-gradient(90deg, rgba(0,0,0,.7), rgba(0,0,0,.15) 65%)` }} />

      <div className="relative flex flex-col md:flex-row md:items-center gap-8 px-6 py-10 md:px-12 md:py-14">
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <span className="self-start inline-flex items-center gap-2 h-[26px] px-3 rounded-full text-[11px] font-extrabold tracking-[1.4px] uppercase" style={{ background: tint(accent, 0.18), color: accent }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
            {pill}
          </span>
          <h1 className="text-5xl md:text-7xl leading-[.95]" style={{ fontFamily: "var(--font-serif)", color: "#F5F0EB" }}>{title}</h1>
          <p className="text-sm" style={{ color: "rgba(245,240,235,.75)" }}>Curated by Aurora · {count} wallpaper{count === 1 ? "" : "s"}</p>
          {description && <p className="text-[15px] leading-relaxed max-w-xl" style={{ color: "rgba(245,240,235,.85)" }}>{description}</p>}
          <button onClick={share} className="self-start mt-2 h-10 px-4 rounded-full inline-flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-85" style={{ background: "rgba(0,0,0,.45)", color: "#F5F0EB", border: "1px solid rgba(255,255,255,.14)" }}>
            <Share2Icon size={15} strokeWidth={2.2} aria-hidden="true" />
            {copied ? "Link copied" : "Share"}
          </button>
        </div>

        {/* fanned trio */}
        <div aria-hidden="true" className="relative hidden sm:block w-[300px] h-[250px] shrink-0 self-center">
          {[
            { w: second, cls: "left-0 top-6 w-[96px] -rotate-[11deg]" },
            { w: third, cls: "right-0 top-6 w-[96px] rotate-[11deg]" },
            { w: first, cls: "left-1/2 -translate-x-1/2 top-0 w-[116px] z-10" },
          ].map(({ w, cls }, i) =>
            w ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={w.id + i}
                src={img(w)}
                alt=""
                className={`absolute aspect-[9/19] object-cover rounded-2xl ${cls}`}
                style={{ background: w.dominantColor, border: i === 2 ? `2px solid ${tint(accent, 0.6)}` : "2px solid rgba(255,255,255,.18)", boxShadow: "0 16px 36px rgba(0,0,0,.6)" }}
              />
            ) : null
          )}
        </div>
      </div>
    </header>
  );
}
