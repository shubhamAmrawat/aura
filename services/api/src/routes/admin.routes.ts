import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin";
import * as stats from "../controllers/admin/stats.controller";
import * as review from "../controllers/admin/review.controller";
import * as wallpapers from "../controllers/admin/wallpapers.controller";
import * as featured from "../controllers/admin/featured.controller";
import * as uploads from "../controllers/admin/upload.controller";
import * as categories from "../controllers/admin/categories.controller";
import * as suggestions from "../controllers/admin/categorySuggestions.controller";
import * as usersCtl from "../controllers/admin/users.controller";
import * as activity from "../controllers/admin/activity.controller";
import * as creatorApps from "../controllers/admin/creatorApplications.controller";
import * as reports from "../controllers/admin/reports.controller";
import * as drops from "../controllers/admin/drops.controller";
import * as notificationsAdmin from "../controllers/admin/notifications.controller";

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

// Drops (editorial collections shown as a home banner)
adminRoutes.get("/drops", drops.list);
adminRoutes.post("/drops", drops.create);
adminRoutes.get("/drops/:id", drops.detail);
adminRoutes.patch("/drops/:id", drops.update);
adminRoutes.put("/drops/:id/wallpapers", drops.items);
adminRoutes.delete("/drops/:id", drops.remove);

// Notifications: broadcast, phones, app versions
adminRoutes.get("/notifications", notificationsAdmin.overview);
adminRoutes.post("/notifications/preview", notificationsAdmin.preview);
adminRoutes.post("/notifications/send", notificationsAdmin.send);
adminRoutes.post("/notifications/test", notificationsAdmin.test);
adminRoutes.get("/notifications/campaigns", notificationsAdmin.campaigns);
adminRoutes.get("/notifications/campaigns/:id", notificationsAdmin.campaign);
adminRoutes.post("/notifications/campaigns/:id/cancel", notificationsAdmin.cancel);
adminRoutes.get("/notifications/users", notificationsAdmin.searchUsers);
adminRoutes.get("/notifications/users/:id", notificationsAdmin.user);
adminRoutes.post("/notifications/devices/remove", notificationsAdmin.removeDevice);
adminRoutes.put("/notifications/rules", notificationsAdmin.rules);
adminRoutes.get("/notifications/templates", notificationsAdmin.templateList);
adminRoutes.post("/notifications/templates", notificationsAdmin.templateCreate);
adminRoutes.get("/notifications/templates/:id", notificationsAdmin.templateGet);
adminRoutes.put("/notifications/templates/:id", notificationsAdmin.templateUpdate);
adminRoutes.delete("/notifications/templates/:id", notificationsAdmin.templateDelete);
adminRoutes.post("/notifications/templates/:id/reset", notificationsAdmin.templateReset);
adminRoutes.get("/notifications/templates/:id/prepare", notificationsAdmin.templatePrepare);
adminRoutes.put("/app-versions", notificationsAdmin.versions);

// Bulk upload (Phase 4)
adminRoutes.post("/uploads/urls", uploads.urls);
adminRoutes.post("/uploads/analyze", uploads.analyze);
adminRoutes.post("/uploads/discard", uploads.discard);
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

// Users (Phase 6)
adminRoutes.get("/users", usersCtl.list);
adminRoutes.get("/users/:id", usersCtl.detail);
adminRoutes.patch("/users/:id", usersCtl.update);
adminRoutes.post("/users/:id/unlock", usersCtl.unlock);
adminRoutes.post("/users/:id/disable", usersCtl.disable);
adminRoutes.post("/users/:id/enable", usersCtl.enable);
adminRoutes.delete("/users/:id", usersCtl.remove);

// Creator applications — /counts before /:id
adminRoutes.get("/creator-applications", creatorApps.list);
adminRoutes.get("/creator-applications/counts", creatorApps.counts);
adminRoutes.get("/creator-applications/:id", creatorApps.detail);
adminRoutes.post("/creator-applications/:id/approve", creatorApps.approve);
adminRoutes.post("/creator-applications/:id/reject", creatorApps.reject);
adminRoutes.post("/creator-applications/:id/rescore", creatorApps.rescore);

// Reports (Play UGC policy) — /counts before /:id
adminRoutes.get("/reports", reports.list);
adminRoutes.get("/reports/counts", reports.counts);
adminRoutes.post("/reports/:id/resolve", reports.resolve);

// Activity log (Phase 8)
adminRoutes.get("/activity", activity.list);
