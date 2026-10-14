import { route } from "../../utils/asyncRoute";
import { parseOrThrow } from "../../utils/validate";
import { FeaturedLimitBody, FeaturedListQuery, FeaturedOrderBody } from "../../validators/admin.schema";
import * as featured from "../../services/featured.service";

/** GET /api/admin/featured?list=web|mobile (default web) */
export const get = route("Failed to load featured wallpapers", async (req, res) => {
  const { list } = parseOrThrow(FeaturedListQuery, req.query);
  res.json(await featured.getAdminFeatured(list));
});

/** PUT /api/admin/featured/order { ids, list? } */
export const order = route("Failed to save order", async (req, res) => {
  const { ids, list } = parseOrThrow(FeaturedOrderBody, req.body);
  res.json(await featured.setFeaturedOrder(req.userId!, ids, list));
});

/** PUT /api/admin/featured/limit { limit, list? } */
export const limit = route("Failed to save limit", async (req, res) => {
  const { limit, list } = parseOrThrow(FeaturedLimitBody, req.body);
  res.json(await featured.setFeaturedLimit(req.userId!, limit, list));
});
