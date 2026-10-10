"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

/**
 * Avatar <img> that falls back (e.g. to initials) if the image fails to load.
 * no-referrer: Google-hosted photos are less likely to be refused.
 */
export default function AvatarImage({ src, alt, className, style, fallback }: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  style?: CSSProperties;
  fallback: ReactNode;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(src)}
      // catches an error that happened before hydration
      ref={(el) => { if (el && el.complete && el.naturalWidth === 0) setFailedSrc(src); }}
    />
  );
}
