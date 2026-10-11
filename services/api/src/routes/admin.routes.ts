import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin";
import * as stats from "../controllers/admin/stats.controller";
import * as review from "../controllers/admin/review.controller";
import * as wallpapers from "../controllers/admin/wallpapers.controller";

/** Everything under /api/admin — admin login required for every route. */
export const adminRoutes = Router();

adminRoutes.use(requireAdmin);

adminRoutes.get("/stats/overview", stats.overview);
adminRoutes.get("/stats/dashboard", stats.dashboard);

// Review queue (Phase 2)
adminRoutes.get("/review", review.list);
adminRoutes.post("/review/bulk", review.bulk);
adminRoutes.post("/review/:id/approve", review.approve);
adminRoutes.post("/review/:id/reject", review.reject);

// Wallpaper management (Phase 3)
adminRoutes.get("/wallpapers", wallpapers.list);
adminRoutes.post("/wallpapers/bulk", wallpapers.bulk);
adminRoutes.get("/wallpapers/:id", wallpapers.detail);
adminRoutes.patch("/wallpapers/:id", wallpapers.update);
adminRoutes.delete("/wallpapers/:id", wallpapers.remove);
