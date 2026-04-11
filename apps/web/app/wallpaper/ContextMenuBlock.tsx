"use client";

import type { CSSProperties, ReactNode } from "react";

/** Blocks context menu on wallpaper imagery; must be a Client Component (handlers cannot live in RSC). */
export function ContextMenuBlock({
  className,
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div className={className} style={style} onContextMenu={(e) => e.preventDefault()}>
      {children}
    </div>
  );
}
