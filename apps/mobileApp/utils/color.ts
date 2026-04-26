// utils/color.ts
export function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Given a hex color, returns whether it is light or dark
 * Based on WCAG relative luminance formula
 */
export function getColorLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function isLightColor(hex: string): boolean {
  return getColorLuminance(hex) > 128;
}

/**
 * Returns black or white depending on which
 * has better contrast against the given background
 */
export function getContrastColor(hex: string): string {
  return isLightColor(hex) ? "#0a0a0a" : "#ffffff";
}

/**
 * Returns a readable text color and a slightly
 * transparent version for secondary text
 */
export function getColorPair(hex: string): {
  text: string;
  textMuted: string;
  bg: string;
} {
  const light = isLightColor(hex);
  return {
    bg: hex,
    text: light ? "#0a0a0a" : "#ffffff",
    textMuted: light ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.5)",
  };
}