/**
 * Which wallpapers the visitor wants to see: all, phone (portrait) or desktop (landscape).
 * Stored in a cookie so the choice sticks across pages and visits, and the server can
 * render filtered lists straight away.
 */
export type Device = "all" | "phone" | "desktop";

export const DEVICE_COOKIE = "aura_device";
export const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function parseDevice(value: string | null | undefined): Device {
  return value === "phone" || value === "desktop" ? value : "all";
}

/** The API's `screen` filter for a device choice (undefined = no filter). */
export function screenFor(device: Device | undefined): "mobile" | "tablet" | undefined {
  if (device === "phone") return "mobile";
  if (device === "desktop") return "tablet";
  return undefined;
}

/**
 * Which device's notifications the inbox shows. Some broadcasts come in a phone and a desktop
 * version (e.g. the wallpaper of the day), so the inbox always picks one: the device filter if
 * it's set, otherwise this screen's size.
 */
export function inboxScreen(device: Device | undefined): "mobile" | "tablet" {
  const s = screenFor(device);
  if (s) return s;
  if (typeof window === "undefined") return "tablet";
  return window.matchMedia("(max-width: 767px)").matches ? "mobile" : "tablet";
}

export const DEVICE_LABEL: Record<Device, string> = { all: "All", phone: "Phone", desktop: "Desktop" };
