"use client";

import { useState } from "react";

interface ColorPaletteProps {
  palette: string[];
}

const ColorPalette = ({ palette }: ColorPaletteProps) => {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (color: string) => {
    navigator.clipboard.writeText(color);
    setCopied(color);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div>
      <p className="text-xs uppercase tracking-widest mb-3 text-text-muted">
        Color Palette
      </p>
      <div className="flex gap-3 flex-wrap">
        {palette.map((color, i) => (
          <button
            key={i}
            onClick={() => handleCopy(color)}
            className="relative group flex flex-col items-center gap-1"
            title={`Copy ${color}`}
          >
            <div
              className="w-8 h-8 rounded-full border transition-transform group-hover:scale-110"
              style={{
                backgroundColor: color,
                borderColor: "var(--border)",
              }}
            />
            <span
              className="text-[10px] font-mono opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: "var(--text-muted)" }}
            >
              {copied === color ? "copied!" : color}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ColorPalette;