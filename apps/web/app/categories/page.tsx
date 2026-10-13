import Link from "next/link";
import type { Metadata } from "next";
import { getCategories } from "@/lib/api";
import { groupCategories } from "@/lib/categoryGroups";

export const metadata: Metadata = {
  title: "All categories",
  description: "Browse every Aurora wallpaper category — nature, space, anime, minimal, devotional art and more, for phone and desktop.",
};

export default async function CategoriesPage() {
  const categories = await getCategories().catch(() => []);
  const groups = groupCategories(categories);

  return (
    <main className="min-h-screen px-4 pb-16 pt-24 sm:px-8 md:px-12" style={{ background: "var(--bg-primary)" }}>
      <div className="mx-auto max-w-[1400px]">
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          All categories
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Pick a theme to browse its wallpapers.
        </p>

        {groups.length === 0 ? (
          <p className="py-24 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            Categories couldn&apos;t be loaded right now. Please try again.
          </p>
        ) : (
          groups.map((g) => (
            <section key={g.title} className="mt-10" aria-labelledby={`group-${g.title}`}>
              <h2 id={`group-${g.title}`} className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>
                {g.title}
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
                {g.items.map((c) => (
                  <Link
                    key={c.id}
                    href={`/category/${c.slug}`}
                    className="group relative block aspect-[3/2] overflow-hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    style={{ background: "var(--bg-elevated)" }}
                  >
                    {c.coverThumbUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.coverThumbUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                      />
                    )}
                    <span className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 35%, rgba(0,0,0,0.78))" }} />
                    <span className="absolute bottom-3 left-3.5 right-3.5 flex items-baseline justify-between gap-2 text-white">
                      <span className="truncate text-base font-semibold">{c.name}</span>
                      {c.wallpaperCount !== undefined && (
                        <span className="shrink-0 text-xs text-white/75">{c.wallpaperCount.toLocaleString("en-IN")}</span>
                      )}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </main>
  );
}
