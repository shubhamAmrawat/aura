import type { NextConfig } from "next";

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
    ],
  },
};

export default nextConfig;
