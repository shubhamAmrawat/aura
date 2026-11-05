import Link from "next/link";
import { ClockIcon } from "lucide-react";
import { endsAtLabel, tint, type DropSpotlight } from "@/lib/drops";

/**
 * Home page banner for the live drop — made entirely from the drop's own wallpapers:
 * blurred backdrop of the first one, a fan of up to 4 cards, and the accent colour picked from them.
 * `preview` = static (admin editor); otherwise a link to the drop page.
 */
export default function DropBanner({ drop, preview }: { drop: DropSpotlight; preview?: boolean }) {
  const [first, second, third, fourth] = drop.preview;
  const accent = drop.accentColor;
  const ends = endsAtLabel(drop.endsAt);
  const img = (w: DropSpotlight["preview"][number] | undefined) => w?.thumbUrl ?? w?.fileUrl;
  // Fan of cards: center (first) on top, the rest tilted behind it. Positions are % of a box that
  // is as tall as the banner and 1.6× as wide, so the cards scale with the banner's height, not
  // the page width.
  const cards = [
    { w: fourth, cls: "right-[75%] top-[17%] w-[21.7%] h-[72%] -rotate-12 hidden lg:block" },
    { w: second, cls: "right-[52%] top-[12%] w-[23.3%] h-[77%] -rotate-[4deg] hidden lg:block" },
    { w: third, cls: "right-[10%] top-[17%] w-[21.7%] h-[72%] rotate-12" },
    { w: first, cls: "right-[29%] top-[9%] w-[25.4%] h-[83%] z-10" },
  ];

  const body = (
    <div
      className="relative block w-full overflow-hidden rounded-[22px] md:rounded-[28px] h-[220px] sm:h-[260px] md:h-[300px]"
      style={{ border: `1px solid ${tint(accent, 0.3)}`, background: "#0a0a0a" }}
    >
      {first && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img(first)} alt="" aria-hidden="true" className="absolute -inset-10 w-[calc(100%+80px)] h-[calc(100%+80px)] max-w-none object-cover" style={{ filter: "blur(30px) brightness(.5) saturate(1.35)" }} />
      )}
      <div aria-hidden="true" className="absolute inset-0" style={{ background: `radial-gradient(60% 120% at 78% 50%, ${tint(accent, 0.3)}, rgba(0,0,0,0) 65%), linear-gradient(90deg, rgba(0,0,0,.72) 0%, rgba(0,0,0,.1) 62%)` }} />

      <div aria-hidden="true" className="absolute right-0 top-0 h-full aspect-[1.6] hidden sm:block">
      {cards.map(({ w, cls }, i) =>
        w ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={w.id + i}
            src={img(w)}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className={`absolute object-cover rounded-xl md:rounded-2xl ${cls}`}
            style={{
              background: w.dominantColor,
              border: i === 3 ? `2px solid ${tint(accent, 0.6)}` : "2px solid rgba(255,255,255,.16)",
              boxShadow: "0 14px 30px rgba(0,0,0,.55)",
            }}
          />
        ) : null
      )}
      </div>

      <div className="absolute left-5 right-5 sm:right-auto sm:left-10 md:left-12 top-6 bottom-6 md:top-11 md:bottom-11 sm:w-[40%] sm:max-w-[520px] flex flex-col justify-between">
        <div className="flex flex-col gap-2 md:gap-3">
          {ends && (
            <span className="self-start inline-flex items-center gap-1.5 text-[13px] md:text-sm font-semibold" style={{ color: "rgba(245,240,235,.85)" }}>
              <ClockIcon size={15} strokeWidth={2.2} aria-hidden style={{ color: accent }} />
              {ends}
            </span>
          )}
          <span className="text-[44px] md:text-[64px] leading-[.95]" style={{ fontFamily: "var(--font-serif)", color: "#F5F0EB" }}>{drop.title}</span>
          <span className="text-sm md:text-[15px] leading-relaxed line-clamp-2" style={{ color: "rgba(245,240,235,.8)" }}>
            {drop.description ?? `${drop.wallpaperCount} wallpapers, hand-picked by Aurora.`}
          </span>
        </div>
        <span
          className="self-start h-10 md:h-11 px-5 rounded-full inline-flex items-center gap-2 text-sm md:text-[14.5px] font-extrabold"
          style={{ background: accent, color: "#140A02" }}
        >
          Explore the drop
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>
        </span>
      </div>
    </div>
  );

  if (preview) return body;
  return (
    <Link href={`/collection/${drop.id}`} aria-label={`${drop.title} — ${drop.wallpaperCount} wallpapers`} className="block transition-transform hover:scale-[1.005]">
      {body}
    </Link>
  );
}
