import { Router } from "express";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { requireAdminSecret } from "../middleware/adminSecret";
import * as wallpapers from "../controllers/wallpaper.controller";
import * as recommendations from "../controllers/recommendation.controller";
import * as daily from "../controllers/daily.controller";

export const wallpaperRoutes = Router();

// Static paths are registered before "/:id" so they win.
wallpaperRoutes.get("/", wallpapers.list);
wallpaperRoutes.get("/feed", optionalAuth, recommendations.getFeed);
wallpaperRoutes.post("/upload-url", requireAuth, wallpapers.uploadUrl);
wallpaperRoutes.post("/upload/prepare", requireAuth, wallpapers.prepareUpload);
wallpaperRoutes.post("/upload/discard", requireAuth, wallpapers.discardUpload);
wallpaperRoutes.post("/upload", requireAuth, wallpapers.upload);
wallpaperRoutes.get("/trending", wallpapers.trending);
wallpaperRoutes.get("/daily", daily.getDaily);
wallpaperRoutes.post("/trending/recalculate", requireAdminSecret, wallpapers.recalculateTrending);
wallpaperRoutes.post("/reembed-text", requireAdminSecret, wallpapers.reembedText);
wallpaperRoutes.get("/:id/similar", wallpapers.similar);
wallpaperRoutes.get("/:id", wallpapers.getOne);
wallpaperRoutes.post("/:id/download", optionalAuth, wallpapers.trackDownload);
wallpaperRoutes.post("/:id/view", wallpapers.trackView);
