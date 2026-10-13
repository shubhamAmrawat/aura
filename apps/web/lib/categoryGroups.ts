import type { Category } from "./api";

/**
 * How the Explore menu groups categories. Keyed by slug; a category not listed here
 * (e.g. one an admin just created) goes under "More" so it is never hidden.
 */
export const CATEGORY_GROUPS: { title: string; slugs: string[] }[] = [
  { title: "Places & nature", slugs: ["nature", "mountains", "ocean", "forest", "sunset", "space", "city", "architecture"] },
  { title: "Art & style", slugs: ["abstract", "minimal", "gradient", "geometric", "dark", "neon", "cyberpunk", "sci-fi", "anime", "ai"] },
  { title: "Interests", slugs: ["hinduism", "superheroes", "cars", "cats", "floral", "sports", "astrology"] },
];

export type CategoryGroup = { title: string; items: Category[] };

/** Categories with live wallpapers (all of them when the API doesn't send counts). */
export function visibleCategories(categories: Category[]): Category[] {
  return categories.filter((c) => c.wallpaperCount === undefined || c.wallpaperCount > 0);
}

/** Visible categories split into the menu groups, in each group's order, plus "More" for the rest. */
export function groupCategories(categories: Category[]): CategoryGroup[] {
  const bySlug = new Map(visibleCategories(categories).map((c) => [c.slug, c]));
  const groups: CategoryGroup[] = CATEGORY_GROUPS.map((g) => ({
    title: g.title,
    items: g.slugs.map((s) => bySlug.get(s)).filter((c): c is Category => Boolean(c)),
  }));
  const placed = new Set(CATEGORY_GROUPS.flatMap((g) => g.slugs));
  const rest = [...bySlug.values()].filter((c) => !placed.has(c.slug));
  if (rest.length) groups.push({ title: "More", items: rest });
  return groups.filter((g) => g.items.length > 0);
}

/** The biggest categories (by live wallpapers), for the "Popular" tiles. */
export function popularCategories(categories: Category[], n = 4): Category[] {
  return [...visibleCategories(categories)]
    .filter((c) => c.coverThumbUrl)
    .sort((a, b) => (b.wallpaperCount ?? 0) - (a.wallpaperCount ?? 0))
    .slice(0, n);
}
