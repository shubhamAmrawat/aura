import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist, Instrument_Serif } from "next/font/google";
import "./globals.css";
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

// Display serif for headlines (sign-in, profile, settings). Not preloaded, so the font
// file only downloads on pages that actually use var(--font-serif).
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
  preload: false,
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
    "dark wallpapers", "nature wallpapers",
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
};

/** Dark browser chrome (address bar, Android task switcher) to match the site. */
export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
};

/** Google Analytics 4 (public measurement ID; override with NEXT_PUBLIC_GA_ID). */
const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-ME86FL2LKY";
/** Only production builds report, so local development doesn't pollute the stats. */
const GA_ENABLED = process.env.NODE_ENV === "production" && /^G-[A-Z0-9]+$/.test(GA_ID);

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch categories server-side so Navbar renders with data immediately,
  // eliminating the client-side fetch that fired on every page mount.
  const categories = await getCategories().catch(() => []);

  return (
    <html lang="en" className={`${geist.variable} ${serif.variable}`}>
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8977455477078936"
          crossOrigin="anonymous"
        />
        <meta name="p:domain_verify" content="c53fab29b15c022c191c58143241d360"/>
      </head>
      <body>
        <AuthProvider>
          <ToastProvider>
            <ConditionalNavbar>
              <Navbar initialCategories={categories} />
            </ConditionalNavbar>
            {children}
            <ConditionalNavbar>
              <Footer />
            </ConditionalNavbar>
          </ToastProvider>
        </AuthProvider>
        {GA_ENABLED && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
            <Script id="ga-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                // The admin dashboard is not part of the public site's traffic.
                if (location.pathname === "/admin" || location.pathname.startsWith("/admin/")) window["ga-disable-${GA_ID}"] = true;
                gtag('js', new Date());
                gtag('config', '${GA_ID}');
              `}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}