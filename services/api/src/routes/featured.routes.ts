import { Router } from "express";
import { route } from "../utils/asyncRoute";
import * as featured from "../services/featured.service";
import { parseScreenFilter } from "../utils/screenFilter";
import { queryParam } from "../utils/request";

export const featuredRoutes = Router();

/** GET /api/featured[?screen=mobile|tablet] — home page hero (admin-chosen order and count), optionally one device shape only. */
featuredRoutes.get(
  "/",
  route("Failed to fetch featured wallpapers", async (req, res) => {
    res.setHeader("Cache-Control", "no-store"); // the web caches it and refreshes on admin save
    res.json(await featured.getPublicFeatured(parseScreenFilter(queryParam(req, "screen"))));
  })
);
