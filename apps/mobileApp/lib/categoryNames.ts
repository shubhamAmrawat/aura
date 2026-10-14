import { Category } from "./api";
import { getCategories } from "./wallpaperApi";

let cache: Promise<Map<string, Category>> | null = null;

/** id → category for all visible categories, fetched once per app session (retried after a failure). */
export function getCategoryMap(): Promise<Map<string, Category>> {
  if (!cache) {
    cache = getCategories()
      .then((list) => new Map(list.map((c) => [c.id, c])))
      .catch((e) => {
        cache = null;
        throw e;
      });
  }
  return cache;
}
