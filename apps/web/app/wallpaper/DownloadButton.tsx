"use client";

import { useState } from "react";

interface DownloadButtonProps {
  wallpaperId: string;
  fileUrl: string;
  title: string;
  dominantColor: string;
  contrastColor: string;
  fullWidth?: boolean;
}

const DownloadButton = ({
  wallpaperId,
  fileUrl,
  title,
  dominantColor,
  contrastColor,
  fullWidth = false,
}: DownloadButtonProps) => {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/wallpapers/${wallpaperId}/download`, {
        method: "POST",
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

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={downloading}
      aria-label="Download wallpaper"
      className={`flex items-center justify-center gap-3 px-8 py-4 rounded-full text-sm font-medium tracking-wider transition-opacity hover:opacity-80 disabled:opacity-70 ${
        fullWidth ? "w-full" : ""
      }`}
      style={{
        background: dominantColor,
        color: contrastColor,
      }}
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
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download Free
        </div>
      )}
    </button>
  );
};

export default DownloadButton;
