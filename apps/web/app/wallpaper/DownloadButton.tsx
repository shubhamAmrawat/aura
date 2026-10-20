"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import { Download, Lock } from "lucide-react";

interface DownloadButtonProps {
  wallpaperId: string;
  fileUrl: string;
  title: string;
  dominantColor: string;
  contrastColor: string;
  fullWidth?: boolean;
}

const LockIcon = ({ color }: { color: string }) => (
  <Lock size={16} strokeWidth={2.5} stroke={color} aria-hidden="true" />
);

const DownloadIcon = () => (
  <Download size={16} strokeWidth={2.5} aria-hidden="true" />
);

const DownloadButton = ({
  wallpaperId,
  fileUrl,
  title,
  dominantColor,
  contrastColor,
  fullWidth = false,
}: DownloadButtonProps) => {
  const [downloading, setDownloading] = useState(false);
  const { user, loaded } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleDownload = () => {
    // gate: must be logged in
    if (!user) {
      // save current page so we redirect back after login
      const next = encodeURIComponent(pathname);
      router.push(`/login?next=${next}`);
      return;
    }

    if (downloading) return;
    setDownloading(true);

    // Track download count (fire-and-forget).
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/wallpapers/${wallpaperId}/download`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "web" }),
    }).catch(() => {});

    try {
      // Build the route URL with the CDN url + filename as query params.
      // The route fetches the file server-side (no CORS) and streams it back
      // with Content-Disposition: attachment — browser shows the save dialog
      // the moment headers arrive and streams to disk natively, so the user
      // sees the dialog immediately instead of waiting for the full file in RAM.
      const params = new URLSearchParams({
        url: fileUrl,
        name: title.replace(/[^a-z0-9]/gi, "_").toLowerCase(),
      });
      const downloadHref = `/api/download/${wallpaperId}?${params.toString()}`;

      // Navigate via a hidden anchor — no fetch, no blob buffering.
      const a = document.createElement("a");
      a.href = downloadHref;
      // 'download' attr only works same-origin; our route IS same-origin so this
      // provides the filename hint as a second layer.
      a.download = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.open(fileUrl, "_blank");
    } finally {
      // Reset button state quickly — the download is handled by the browser now.
      setTimeout(() => setDownloading(false), 1500);
    }
  };

  const buttonClass = `flex items-center justify-center gap-3 px-4 sm:px-8 py-4 rounded-full text-sm font-medium whitespace-nowrap sm:tracking-wider transition-opacity hover:opacity-80 disabled:opacity-70 ${
    fullWidth ? "w-full" : ""
  }`;

  // loading state — auth not resolved yet
  if (!loaded) {
    return (
      <button
        type="button"
        disabled
        className={buttonClass}
        style={{ background: dominantColor, color: contrastColor, opacity: 0.7 }}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <DownloadIcon />
          Download Free
        </div>
      </button>
    );
  }

  // not logged in — show lock state
  if (!user) {
    return (
      <button
        type="button"
        onClick={handleDownload}
        aria-label="Sign in to download wallpaper"
        className={buttonClass}
        style={{ background: dominantColor, color: contrastColor }}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <LockIcon color={contrastColor} />
          Sign in to Download
        </div>
      </button>
    );
  }

  // logged in — normal download
  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={downloading}
      aria-label="Download wallpaper"
      className={buttonClass}
      style={{ background: dominantColor, color: contrastColor }}
    >
      {downloading ? (
        <div className="flex items-center gap-2 sm:gap-3">
          <div
            className="w-4 h-4 rounded-full border-2 animate-spin"
            style={{
              borderColor: `${contrastColor}40`,
              borderTopColor: contrastColor,
            }}
          />
          Downloading…
        </div>
      ) : (
        <div className="flex items-center gap-2 sm:gap-3">
          <DownloadIcon />
          Download Free
        </div>
      )}
    </button>
  );
};

export default DownloadButton;