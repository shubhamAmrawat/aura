import { Router } from "express";
import { optionalAuth, requireAuth } from "../middleware/auth";
import * as moderation from "../controllers/moderation.controller";

/** /api/reports — report a wallpaper or a user */
export const reportRoutes = Router();
reportRoutes.post("/", optionalAuth, moderation.report);

/** /api/blocks — the signed-in user's blocked accounts */
export const blockRoutes = Router();
blockRoutes.use(requireAuth);
blockRoutes.get("/", moderation.listBlocks);
blockRoutes.post("/:userId", moderation.block);
blockRoutes.delete("/:userId", moderation.unblock);
