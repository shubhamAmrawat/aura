import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin";
import * as stats from "../controllers/admin/stats.controller";
import * as review from "../controllers/admin/review.controller";
import * as wallpapers from "../controllers/admin/wallpapers.controller";
import * as featured from "../controllers/admin/featured.controller";
import * as uploads from "../controllers/admin/upload.controller";
import * as categories from "../controllers/admin/categories.controller";
import * as suggestions from "../controllers/admin/categorySuggestions.controller";

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

// Featured / home page hero
adminRoutes.get("/featured", featured.get);
adminRoutes.put("/featured/order", featured.order);
adminRoutes.put("/featured/limit", featured.limit);

// Bulk upload (Phase 4)
adminRoutes.post("/uploads/urls", uploads.urls);
adminRoutes.post("/uploads", uploads.create);

// Categories (Phase 5) — /order before /:id
adminRoutes.get("/categories", categories.list);
adminRoutes.post("/categories", categories.create);
adminRoutes.put("/categories/order", categories.order);
adminRoutes.get("/categories/suggestions", suggestions.list);
adminRoutes.post("/categories/suggestions/apply", suggestions.apply);
adminRoutes.post("/categories/suggestions/dismiss", suggestions.dismiss);
adminRoutes.patch("/categories/:id", categories.update);
adminRoutes.delete("/categories/:id", categories.remove);
