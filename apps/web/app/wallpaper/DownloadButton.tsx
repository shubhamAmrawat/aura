"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/authContext";

interface DownloadButtonProps {
  wallpaperId: string;
  fileUrl: string;
  title: string;
  dominantColor: string;
  contrastColor: string;
  fullWidth?: boolean;
}

const LockIcon = ({ color }: { color: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
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

  const handleDownload = async () => {
    // gate: must be logged in
    if (!user) {
      // save current page so we redirect back after login
      const next = encodeURIComponent(pathname);
      router.push(`/login?next=${next}`);
      return;
    }

    if (downloading) return;
    setDownloading(true);
    try {
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/wallpapers/${wallpaperId}/download`, {
        method: "POST",
        credentials: "include",
      }).catch(() => {});

      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      window.open(fileUrl, "_blank");
    } finally {
      setDownloading(false);
    }
  };

  const buttonClass = `flex items-center justify-center gap-3 px-8 py-4 rounded-full text-sm font-medium tracking-wider transition-opacity hover:opacity-80 disabled:opacity-70 ${
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
        <div className="flex items-center gap-3">
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
        <div className="flex items-center gap-3">
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
        <div className="flex items-center gap-3">
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
        <div className="flex items-center gap-3">
          <DownloadIcon />
          Download Free
        </div>
      )}
    </button>
  );
};

export default DownloadButton;