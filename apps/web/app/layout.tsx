import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { SITE_LOGO_URL } from "@/lib/site";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import ConditionalNavbar from "@/app/components/ConditionalNavbar";
import { ToastProvider } from "@/lib/toast";
import { AuthProvider } from "@/lib/authContext";
import { getCategories } from "@/lib/api";


const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.aurora-walls.com"),
  title: {
    default: "Aurora | Premium Wallpaper Discovery",
    template: "%s | Aurora",
  },
  description: "Discover and download premium wallpapers for desktop and mobile. Curated collections, high resolution, free to use.",
  keywords: [
    "wallpapers", "4K wallpapers", "desktop wallpapers",
    "mobile wallpapers", "free wallpapers", "HD wallpapers",
    "anime wallpapers", "dark wallpapers", "nature wallpapers",
    "minimal wallpapers", "aesthetic wallpapers", "phone wallpapers"
  ],
  openGraph: {
    type: "website",
    siteName: "Aurora",
    title: "Aurora — Premium Wallpaper Discovery",
    description: "Discover and download premium wallpapers for desktop and mobile.",
    url: "https://www.aurora-walls.com",
  },
  twitter: {
    card: "summary_large_image",
    title: "Aurora — Premium Wallpaper Discovery",
    description: "Discover and download premium wallpapers for desktop and mobile.",
  },
  verification: {
    google: "YOOLGUwpRkHS7YCgE1_lseYDOh2BnilnWFIoI_50KuI",
  },
  icons: {
    icon: SITE_LOGO_URL,
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch categories server-side so Navbar renders with data immediately,
  // eliminating the client-side fetch that fired on every page mount.
  const categories = await getCategories().catch(() => []);

  return (
    <html lang="en" className={geist.variable}>
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8977455477078936"
          crossOrigin="anonymous"
        />
        {/*
          NOTE: Adsterra popunder script intentionally removed.
          Popunder ads attach a global document click listener and hijack the
          first user interaction on the page — causing every wallpaper card
          click to open an ad tab instead of the wallpaper detail page.
          Use only inline banner ads (AdBanner component) which are safely
          scoped to their own container.
        */}
      </head>
      <body>
        <AuthProvider>
          <ToastProvider>
            <ConditionalNavbar>
              <Navbar initialCategories={categories} />
            </ConditionalNavbar>
            {children}
            <Footer />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}