"use client";

import { useEffect, useRef } from "react";

/** Counts one view per wallpaper page load (fire-and-forget). */
export function ViewTracker({ wallpaperId }: { wallpaperId: string }) {
  const sentFor = useRef<string | null>(null);

  useEffect(() => {
    if (sentFor.current === wallpaperId) return; // guards React StrictMode double-effects
    sentFor.current = wallpaperId;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/wallpapers/${wallpaperId}/view`, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "web" }),
    }).catch(() => {});
  }, [wallpaperId]);

  return null;
}
