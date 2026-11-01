// Drops (editorial collections, e.g. "Diwali Drops") — shared helpers for the web home banner,
// the collection page and the admin editor.

export type DropPreviewItem = {
  id: string;
  title: string;
  fileUrl: string;
  thumbUrl: string | null;
  dominantColor: string;
  width: number;
  height: number;
  isMobile: boolean;
};

export type DropSpotlight = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string | null;
  endsAt: string | null;
  wallpaperCount: number;
  accentColor: string;
  preview: DropPreviewItem[];
};

/** "ends in 6 days" / "ends today" / "ends tomorrow"; null when open-ended or already over. */
export function endsInLabel(endsAt: string | null, now = Date.now()): string | null {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - now;
  if (!(ms > 0)) return null;
  const hours = ms / 3_600_000;
  if (hours < 24) return hours < 1 ? "ends soon" : `ends in ${Math.floor(hours)}h`;
  const days = Math.ceil(hours / 24);
  return days === 1 ? "ends tomorrow" : `ends in ${days} days`;
}

/** "Diwali Drops" → "Diwali" (the admin types only the name). */
export const dropName = (title: string) => title.replace(/\s+drops?$/i, "").trim();
export const dropTitle = (name: string) => `${name.trim()} Drops`;

// Same as the API's accentFrom (services/api/src/services/drop.service.ts) — for the admin's live preview.
const FALLBACK_ACCENT = "#81EE4E";

function hexToHsl(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToHex(h: number, s: number, l: number) {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return "#" + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}

const vivid = (hsl: [number, number, number]) => hsl[1] * (1 - Math.abs(2 * hsl[2] - 1));

export function accentFrom(colors: (string | null | undefined)[]): string {
  let best: [number, number, number] | null = null;
  for (const c of colors.slice(0, 6)) {
    const hsl = c ? hexToHsl(c) : null;
    if (hsl && (!best || vivid(hsl) > vivid(best))) best = hsl;
  }
  if (!best || vivid(best) < 0.06) return FALLBACK_ACCENT;
  return hslToHex(best[0], Math.max(best[1], 0.75), 0.62);
}

/** rgba() of a hex colour. */
export function tint(hex: string, alpha: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
