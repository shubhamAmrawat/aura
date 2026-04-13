import type { NextConfig } from "next";

const avatarHost = (() => {
  const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (!publicUrl) return null;
  try {
    return new URL(publicUrl).hostname;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  turbopack: {
    root: "../../",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
      {
        protocol: "https",
        hostname: "w.wallhaven.cc",
      },
      {
        protocol: "https",
        hostname: "images-assets.nasa.gov",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "**.r2.dev",
      },
      {
        protocol: "https", 
        hostname: "pub-*.r2.dev",  // more specific pattern
      },
      ...(avatarHost
        ? [
            {
              protocol: "https" as const,
              hostname: avatarHost,
            },
          ]
        : []),
    ],
  },
   devIndicators: false,
};

export default nextConfig;
