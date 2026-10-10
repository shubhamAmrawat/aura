import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireAdminSecret } from "../middleware/adminSecret";
import * as wallpapers from "../controllers/wallpaper.controller";

export const wallpaperRoutes = Router();

// Static paths are registered before "/:id" so they win.
wallpaperRoutes.get("/", wallpapers.list);
wallpaperRoutes.post("/upload-url", requireAuth, wallpapers.uploadUrl);
wallpaperRoutes.post("/upload", requireAuth, wallpapers.upload);
wallpaperRoutes.get("/trending", wallpapers.trending);
wallpaperRoutes.post("/trending/recalculate", requireAdminSecret, wallpapers.recalculateTrending);
wallpaperRoutes.post("/reembed-text", requireAdminSecret, wallpapers.reembedText);
wallpaperRoutes.get("/:id/similar", wallpapers.similar);
wallpaperRoutes.get("/:id", wallpapers.getOne);
wallpaperRoutes.post("/:id/download", wallpapers.trackDownload);
