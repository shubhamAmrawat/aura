import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin";
import * as stats from "../controllers/admin/stats.controller";

/** Everything under /api/admin — admin login required for every route. */
export const adminRoutes = Router();

adminRoutes.use(requireAdmin);

adminRoutes.get("/stats/overview", stats.overview);
