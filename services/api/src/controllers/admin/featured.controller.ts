import { route } from "../../utils/asyncRoute";
import { parseOrThrow } from "../../utils/validate";
import { FeaturedLimitBody, FeaturedOrderBody } from "../../validators/admin.schema";
import * as featured from "../../services/featured.service";

/** GET /api/admin/featured */
export const get = route("Failed to load featured wallpapers", async (_req, res) => {
  res.json(await featured.getAdminFeatured());
});

/** PUT /api/admin/featured/order { ids } */
export const order = route("Failed to save order", async (req, res) => {
  const { ids } = parseOrThrow(FeaturedOrderBody, req.body);
  res.json(await featured.setFeaturedOrder(req.userId!, ids));
});

/** PUT /api/admin/featured/limit { limit } */
export const limit = route("Failed to save limit", async (req, res) => {
  const { limit } = parseOrThrow(FeaturedLimitBody, req.body);
  res.json(await featured.setFeaturedLimit(req.userId!, limit));
});
