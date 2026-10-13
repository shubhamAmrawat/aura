"use client";

/**
 * AI generator — shared types, pricing, mock data and small UI pieces.
 * Layout only: nothing here calls a model yet (see docs/ai-generator-plan.md).
 */

export type Mode = "prompt" | "theme" | "remix";
export type Format = "phone" | "desktop" | "both";
export type ModelId = "nb2" | "nbpro";
export type Res = "1K" | "2K" | "4K";

export type Qa = { overall: number; composition: number; sharpness: number; anatomy: number; noText: number; aesthetic: number };

export type GenImage = {
  id: string;
  url: string;
  color: string;
  format: "phone" | "desktop";
  qa: Qa;
  flags: string[];
  starred: boolean;
};

export type Job = {
  id: string;
  mode: Mode;
  prompt: string;
  model: ModelId;
  res: Res;
  format: Format;
  createdAt: string;
  cost: number;
  status: "done" | "running";
  images: GenImage[];
  pending?: number;
};

export const MODELS: Record<ModelId, { name: string; role: string; blurb: string }> = {
  nb2: { name: "Nano Banana 2", role: "Explore", blurb: "Fast and cheap — for trying ideas" },
  nbpro: { name: "Nano Banana Pro", role: "Final", blurb: "Best detail and prompt-following" },
};

/** USD per image, Gemini API standard pricing (Oct 2026). Batch = 50 % off. */
export const PRICE: Record<ModelId, Record<Res, number>> = {
  nb2: { "1K": 0.067, "2K": 0.101, "4K": 0.151 },
  nbpro: { "1K": 0.134, "2K": 0.134, "4K": 0.24 },
};

/** Output size per aspect ratio (Gemini image models). */
export const DIMS: Record<"phone" | "desktop", Record<Res, string>> = {
  phone: { "1K": "768 × 1376", "2K": "1536 × 2752", "4K": "3072 × 5504" },
  desktop: { "1K": "1376 × 768", "2K": "2752 × 1536", "4K": "5504 × 3072" },
};

export const PRESETS = [
  { id: "cinematic", label: "Cinematic", hint: "wide lens, volumetric light, film grain" },
  { id: "anime", label: "Anime", hint: "cel shading, painted sky, clean line art" },
  { id: "minimal", label: "Minimal", hint: "negative space, two-tone palette, soft gradients" },
  { id: "devotional", label: "Devotional art", hint: "rich gold detail, temple lighting, serene" },
  { id: "neon", label: "Neon / Cyberpunk", hint: "rain-slick streets, magenta and cyan glow" },
  { id: "space", label: "Space", hint: "nebula, deep blacks, star field" },
  { id: "nature", label: "Nature", hint: "golden hour, mist, high dynamic range" },
  { id: "abstract", label: "Abstract", hint: "fluid shapes, glass, soft 3D" },
] as const;

export const usd = (n: number) => (n < 1 ? `$${n.toFixed(3).replace(/0$/, "")}` : `$${n.toFixed(2)}`);

export const BUDGET = { cap: 15, spent: 3.42 };

/* ---------- mock data (until the API exists) ---------- */

const QA_SETS: Array<Pick<GenImage, "qa" | "flags">> = [
  { qa: { overall: 91, composition: 94, sharpness: 90, anatomy: 96, noText: 100, aesthetic: 88 }, flags: [] },
  { qa: { overall: 84, composition: 80, sharpness: 88, anatomy: 92, noText: 100, aesthetic: 82 }, flags: [] },
  { qa: { overall: 72, composition: 62, sharpness: 85, anatomy: 90, noText: 100, aesthetic: 76 }, flags: ["Subject behind clock"] },
  { qa: { overall: 58, composition: 78, sharpness: 70, anatomy: 88, noText: 40, aesthetic: 74 }, flags: ["Stray text"] },
];

export function mockJobs(phone: { fileUrl: string; dominantColor: string }[], desktop: { fileUrl: string; dominantColor: string }[]): Job[] {
  const img = (w: { fileUrl: string; dominantColor: string }, i: number, format: "phone" | "desktop", job: string): GenImage => ({
    id: `${job}-${i}`,
    url: w.fileUrl,
    color: w.dominantColor,
    format,
    starred: i === 0,
    ...QA_SETS[i % QA_SETS.length]!,
  });
  return [
    {
      id: "j3",
      mode: "theme",
      prompt: "Diwali night over Varanasi ghats — thousands of diyas floating on the Ganges, fireworks reflected in the water",
      model: "nb2",
      res: "1K",
      format: "phone",
      createdAt: "Just now",
      cost: 0.268,
      status: "running",
      images: [],
      pending: 4,
    },
    {
      id: "j2",
      mode: "prompt",
      prompt: "Lone lighthouse on a basalt cliff at blue hour, storm clearing, long-exposure sea, calm sky at the top for the clock",
      model: "nbpro",
      res: "4K",
      format: "phone",
      createdAt: "12:41 PM",
      cost: 0.96,
      status: "done",
      images: phone.slice(0, 4).map((w, i) => img(w, i, "phone", "j2")),
    },
    {
      id: "j1",
      mode: "prompt",
      prompt: "Misty pine valley at sunrise, layered ridgelines fading into haze, warm gold and teal palette, quiet left side for icons",
      model: "nb2",
      res: "2K",
      format: "desktop",
      createdAt: "11:58 AM",
      cost: 0.404,
      status: "done",
      images: desktop.slice(0, 4).map((w, i) => img(w, (i + 1) % 4, "desktop", "j1")),
    },
  ];
}

/* ---------- small UI pieces ---------- */

export function Panel({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-xl ${className}`} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", ...style }}>
      {children}
    </div>
  );
}

export function Label({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 mb-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{children}</span>
      {hint && <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{hint}</span>}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, size = "md" }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; title?: string }[];
  size?: "sm" | "md";
}) {
  return (
    <div className="flex p-0.5 rounded-lg gap-0.5" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }} role="radiogroup">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded-md font-medium transition-colors whitespace-nowrap ${size === "sm" ? "text-xs px-2 py-1" : "text-sm px-2.5 py-1.5"}`}
            style={on ? { background: "var(--bg-elevated)", color: "var(--text-primary)", boxShadow: "0 1px 0 rgba(255,255,255,0.06) inset, 0 1px 3px rgba(0,0,0,0.4)" } : { color: "var(--text-secondary)" }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Chip({ on, onClick, children, title }: { on?: boolean; onClick?: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={on}
      className="text-xs px-2.5 py-1 rounded-full transition-colors"
      style={on
        ? { background: "rgba(129,238,78,0.12)", color: "var(--accent)", border: "1px solid rgba(129,238,78,0.4)" }
        : { color: "var(--text-secondary)", border: "1px solid var(--border-hover)" }}
    >
      {children}
    </button>
  );
}

export function qaColor(score: number) {
  return score >= 80 ? "#7bc95a" : score >= 65 ? "#eab308" : "#ef4444";
}

export const ico = (d: React.ReactNode, size = 14) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);

export const ICONS = {
  sparkle: ico(<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />),
  star: ico(<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />),
  shuffle: ico(<><polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" /><polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" /><line x1="4" y1="4" x2="9" y2="9" /></>),
  upscale: ico(<><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></>),
  ref: ico(<><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></>),
  trash: ico(<><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></>),
  copy: ico(<><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>),
  plus: ico(<><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>),
  edit: ico(<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>),
  warn: ico(<><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>),
  close: ico(<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>),
  check: ico(<polyline points="20 6 9 17 4 12" />),
  rerun: ico(<><polyline points="23 4 23 10 17 10" /><path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10" /></>),
};
