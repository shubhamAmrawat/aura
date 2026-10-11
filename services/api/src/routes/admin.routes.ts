import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin";
import * as stats from "../controllers/admin/stats.controller";
import * as review from "../controllers/admin/review.controller";

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
