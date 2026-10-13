/**
 * Plain-language facts about a wallpaper, worked out from its own data
 * (size, orientation, colours). Used for the "About this wallpaper" section.
 */

/** Common screen shapes, so 1080×1920 reads "9:16" rather than "9:16.000". */
const RATIOS: [number, string][] = [
  [16 / 9, "16:9"], [16 / 10, "16:10"], [21 / 9, "21:9"], [32 / 9, "32:9"], [4 / 3, "4:3"], [3 / 2, "3:2"], [1, "1:1"],
  [9 / 16, "9:16"], [9 / 19.5, "9:19.5"], [9 / 20, "9:20"], [9 / 21, "9:21"], [3 / 4, "3:4"], [2 / 3, "2:3"], [10 / 16, "10:16"],
];

export function aspectLabel(width: number, height: number): string | null {
  const r = width / height;
  let best: [number, string] | null = null;
  for (const c of RATIOS) if (!best || Math.abs(c[0] - r) < Math.abs(best[0] - r)) best = c;
  return best && Math.abs(best[0] - r) / r < 0.03 ? best[1] : null;
}

/** Which screens the image fits, from its pixel size. */
export function screenFit(width: number, height: number): string {
  if (height > width) {
    if (height >= 2400) return "Its tall, high-resolution frame stays sharp on modern phones, including large iPhone and Android displays";
    if (height >= 1600) return "It is sized for phone lock and home screens";
    return "It suits phone screens and smaller displays";
  }
  if (width === height) return "Its square frame works as a phone, tablet or profile background";
  if (width / height >= 2.2) return "Its extra-wide frame is made for ultrawide and dual-monitor setups";
  if (width >= 3840) return "At 4K resolution it stays sharp on 4K monitors, large TVs and high-density laptop screens";
  if (width >= 2560) return "It is sharp on 1440p monitors and high-resolution laptop screens";
  if (width >= 1920) return "It fits Full HD (1080p) laptops and monitors";
  return "It looks best on smaller screens and laptops";
}

/** Rough colour name for a hex value (for readable text, not colour science). */
export function colorName(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (l < 0.12) return "black";
  if (l > 0.92) return "white";
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (s < 0.15) return l < 0.35 ? "charcoal" : l < 0.7 ? "grey" : "silver";
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  if (h >= 15 && h < 45 && l < 0.42) return "brown";
  if (h < 15 || h >= 345) return l > 0.7 ? "pink" : "red";
  if (h < 45) return l > 0.75 ? "peach" : "orange";
  if (h < 65) return l < 0.45 ? "olive" : "yellow";
  if (h < 160) return "green";
  if (h < 190) return "teal";
  if (h < 250) return "blue";
  if (h < 290) return "purple";
  return "pink";
}

/** Up to three distinct colour names, most prominent first. */
export function paletteNames(palette: string[]): string[] {
  const out: string[] = [];
  for (const hex of palette) {
    const name = colorName(hex);
    if (name && !out.includes(name)) out.push(name);
    if (out.length === 3) break;
  }
  return out;
}

export const listJoin = (items: string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
