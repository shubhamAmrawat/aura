import { route } from "../utils/asyncRoute";
import { listCategories } from "../services/category.service";

export const getCategories = route("Failed to fetch categories", async (_req, res) => {
  const data = await listCategories();
  res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
  res.json({ data });
});
