import { Suspense } from "react";
import type { Metadata } from "next";
import { getCategories } from "@/lib/api";
import InterestsPicker, { type PickerCategory } from "./InterestsPicker";

export const metadata: Metadata = {
  title: "Pick your interests",
  robots: { index: false, follow: false },
};

/** After sign-up (and from Settings): pick up to 4 categories for the home feed. */
export default async function WelcomePage() {
  const all = await getCategories().catch(() => []);
  const categories: PickerCategory[] = all
    .filter((c) => (c.wallpaperCount ?? 1) > 0 && (c.coverThumbUrl || c.coverImageUrl))
    .map((c) => ({ id: c.id, slug: c.slug, name: c.name, image: (c.coverThumbUrl || c.coverImageUrl)! }));

  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: "var(--bg-primary)" }} />}>
      <InterestsPicker categories={categories} />
    </Suspense>
  );
}
