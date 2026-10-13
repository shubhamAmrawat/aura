import Link from "next/link";
import type { Wallpaper } from "@aura/types";
import { aspectLabel, listJoin, paletteNames, screenFit } from "@/lib/wallpaperAbout";

interface AboutWallpaperProps {
  wallpaper: Wallpaper;
  category: { name: string; slug: string } | null;
}

/** "About this wallpaper": readable facts built from the wallpaper's own data. */
export default function AboutWallpaper({ wallpaper: w, category }: AboutWallpaperProps) {
  const orientation = w.height > w.width ? "portrait" : w.width === w.height ? "square" : "landscape";
  const device = w.height > w.width ? "phone" : "desktop";
  const aspect = aspectLabel(w.width, w.height);
  const colors = paletteNames(w.palette ?? []);
  const format = w.format === "jpeg" ? "JPG" : w.format.toUpperCase();

  return (
    <section aria-labelledby="about-wallpaper" className="max-w-2xl">
      <h2 id="about-wallpaper" className="text-xs uppercase tracking-widest mb-3 text-text-muted">
        About this wallpaper
      </h2>
      <div className="flex flex-col gap-3 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        <p>
          {w.title} is a {orientation} {device} wallpaper at {w.width} × {w.height} pixels
          {aspect ? ` (${aspect})` : ""}, available as a free {format} download. {screenFit(w.width, w.height)}.
          {colors.length > 0 && <> The palette is led by {listJoin(colors)} tones.</>}
        </p>
        <p>
          {category ? (
            <>
              It is part of our{" "}
              <Link href={`/category/${category.slug}`} className="underline underline-offset-2 hover:text-white">
                {category.name} wallpapers
              </Link>{" "}
              collection
            </>
          ) : (
            <>Browse more in our <Link href="/categories" className="underline underline-offset-2 hover:text-white">categories</Link></>
          )}
          , and the &ldquo;Similar vibes&rdquo; picks below are matched by look and mood.{" "}
          {device === "phone" ? (
            <>
              New to changing wallpapers? Our guide on{" "}
              <Link href="/blog/how-to-change-wallpaper-android-ios" className="underline underline-offset-2 hover:text-white">
                how to set a wallpaper on Android and iPhone
              </Link>{" "}
              walks through it step by step.
            </>
          ) : (
            <>
              Not sure which resolution suits your monitor? Our{" "}
              <Link href="/blog/4k-wallpapers-guide" className="underline underline-offset-2 hover:text-white">
                guide to 4K wallpapers
              </Link>{" "}
              explains it.
            </>
          )}
        </p>
      </div>
    </section>
  );
}
