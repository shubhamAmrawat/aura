import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { SITE_LOGO_URL } from "@/lib/site";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import ConditionalNavbar from "@/app/components/ConditionalNavbar";
import { ToastProvider } from "@/lib/toast";
import { AuthProvider } from "@/lib/authContext";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={geist.variable}>
      <body>
        <AuthProvider>
          <ToastProvider>
            <ConditionalNavbar>
              <Navbar />
            </ConditionalNavbar>
            {children}
            <Footer />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}