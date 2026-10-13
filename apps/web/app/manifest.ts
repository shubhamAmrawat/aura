import type { MetadataRoute } from "next";

/** Web app manifest: name, colours and home-screen icons for "Add to Home screen". */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aurora — Premium Wallpapers",
    short_name: "Aurora",
    description: "Discover and download premium wallpapers for desktop and mobile.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/brand/aurora-app-icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/aurora-app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
