import { Router } from "express";
import { optionalAuth, requireAuth } from "../middleware/auth";
import * as collections from "../controllers/collection.controller";

export const collectionRoutes = Router();

// Public (registered first; static paths before "/:id")
collectionRoutes.get("/public", collections.listPublic);
collectionRoutes.get("/saved-ids", requireAuth, collections.savedIds);
collectionRoutes.get("/:id", optionalAuth, collections.getOne);

// Everything below requires auth
collectionRoutes.use(requireAuth);

collectionRoutes.get("/", collections.listMine);
collectionRoutes.post("/", collections.create);
collectionRoutes.put("/:id", collections.update);
collectionRoutes.delete("/:id", collections.remove);
collectionRoutes.post("/:id/wallpapers", collections.addWallpaper);
collectionRoutes.delete("/:id/wallpapers/:wallpaperId", collections.removeWallpaper);
collectionRoutes.get("/check/:wallpaperId", collections.check);
