import { request } from "./api";
import type { ScreenFilter } from "./wallpaperApi";

/** Drops: limited editorial collections like "Diwali Drops" (admin › Drops). */

export type DropPreviewItem = {
  id: string;
  title: string;
  fileUrl: string;
  thumbUrl: string | null;
  blurhash: string | null;
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

/** Extra details on a drop's collection response. */
export type DropInfo = {
  status: "live" | "ended";
  startsAt: string | null;
  endsAt: string | null;
  accentColor: string;
  preview: DropPreviewItem[];
};

/** The live drop for the home banner, or null. */
export async function getDropSpotlight(screen: ScreenFilter): Promise<DropSpotlight | null> {
  const res = await request<{ data: DropSpotlight | null }>(`/api/collections/spotlight?placement=app&screen=${screen}`);
  return res.data ?? null;
}

/** "ends in 6 days" / "ends tomorrow" / "ends in 5h"; null when open-ended or over. */
export function endsInLabel(endsAt: string | null, now = Date.now()): string | null {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - now;
  if (!(ms > 0)) return null;
  const hours = ms / 3_600_000;
  if (hours < 24) return hours < 1 ? "ends soon" : `ends in ${Math.floor(hours)}h`;
  const days = Math.ceil(hours / 24);
  return days === 1 ? "ends tomorrow" : `ends in ${days} days`;
}

/** rgba() of a #rrggbb colour. */
export function tint(hex: string, alpha: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  if (Number.isNaN(n)) return `rgba(129,238,78,${alpha})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export const dropUrl = (id: string) => `https://www.aurora-walls.com/collection/${id}`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Ends today, 3:07 PM" / "Ends tomorrow, 9:00 AM" / "Ends 18 Nov, 3:07 PM" (local time); null = no end or already ended. */
export function endsAtLabel(endsAt: string | null, now = new Date()): string | null {
  if (!endsAt) return null;
  const d = new Date(endsAt);
  if (!(d.getTime() > now.getTime())) return null;
  const h = d.getHours() % 12 || 12;
  const time = `${h}:${String(d.getMinutes()).padStart(2, "0")} ${d.getHours() < 12 ? "AM" : "PM"}`;
  const dayStart = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((dayStart(d) - dayStart(now)) / 86_400_000);
  const day = days === 0 ? "today" : days === 1 ? "tomorrow" : `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : ""}`;
  return `Ends ${day}, ${time}`;
}
