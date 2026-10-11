import { Router } from "express";
import { route } from "../utils/asyncRoute";
import * as featured from "../services/featured.service";

export const featuredRoutes = Router();

/** GET /api/featured — home page hero (admin-chosen order and count). */
featuredRoutes.get(
  "/",
  route("Failed to fetch featured wallpapers", async (_req, res) => {
    res.setHeader("Cache-Control", "no-store"); // the web caches it and refreshes on admin save
    res.json(await featured.getPublicFeatured());
  })
);
