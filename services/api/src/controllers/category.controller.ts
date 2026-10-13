import { route } from "../utils/asyncRoute";
import { listCategories, listCategoryRedirects, resolveCategorySlug } from "../services/category.service";
import { param } from "../utils/request";
import { ApiError } from "../utils/ApiError";

export const getCategories = route("Failed to fetch categories", async (_req, res) => {
  const data = await listCategories();
  res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
  res.json({ data });
});

/** GET /api/categories/redirects → { data: { [oldSlug]: currentSlug } } (used by the web middleware) */
export const redirects = route("Failed to load category redirects", async (_req, res) => {
  res.setHeader("Cache-Control", "public, s-maxage=300");
  res.json({ data: await listCategoryRedirects() });
});

/** GET /api/categories/resolve/:slug → { slug, redirected, name, description, intro } — follows renamed/merged categories */
export const resolveSlug = route("Failed to resolve category", async (req, res) => {
  const found = await resolveCategorySlug(param(req, "slug").toLowerCase());
  if (!found) throw new ApiError(404, "Category not found");
  res.setHeader("Cache-Control", "public, s-maxage=3600");
  res.json({ slug: found.slug, redirected: found.redirected, name: found.name, description: found.description, intro: found.intro });
});
