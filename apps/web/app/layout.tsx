import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
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
  metadataBase: new URL("https://www.aurawalls.site"),
  title: {
    default: "AURA — Premium Wallpaper Discovery",
    template: "%s | AURA",
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
    siteName: "AURA",
    title: "AURA — Premium Wallpaper Discovery",
    description: "Discover and download premium wallpapers for desktop and mobile.",
    url: "https://www.aurawalls.site",
  },
  twitter: {
    card: "summary_large_image",
    title: "AURA — Premium Wallpaper Discovery",
    description: "Discover and download premium wallpapers for desktop and mobile.",
  },
  verification: {
    google: "9suXfIJh1lSuADwaJEhrw7mzObWQ2K_uferWeqaauDw",
  },
  icons: {
    icon: "/logo_1266.png"
  }
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