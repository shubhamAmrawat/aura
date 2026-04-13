import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/profile", "/upload", "/login"],
    },
    sitemap: "https://www.aurawalls.site/sitemap.xml",
  };
}