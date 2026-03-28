import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Navbar from "@/app/components/Navbar";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title:"AURA | Premium Wallpapers",
  description: "Discover and download stunning wallpapers curated for every mood.",
  icons:{
    icon:"/4.png"
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
        <Navbar/>
        {children}
      </body>
    </html>
  );
}