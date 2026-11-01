import { Router } from "express";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { requireAdminSecret } from "../middleware/adminSecret";
import * as n from "../controllers/notification.controller";

export const notificationRoutes = Router();

notificationRoutes.get("/", optionalAuth, n.inbox);
notificationRoutes.get("/unread", optionalAuth, n.unread);
notificationRoutes.post("/seen", requireAuth, n.seen);
notificationRoutes.post("/devices", optionalAuth, n.registerDevice);
notificationRoutes.get("/devices/prefs", n.getPrefs);
notificationRoutes.put("/devices/prefs", n.setPrefs);
notificationRoutes.post("/devices/disable", n.disableDevice);
notificationRoutes.post("/opened", n.opened);
notificationRoutes.get("/web/key", n.webKey);
notificationRoutes.post("/web/subscribe", optionalAuth, n.webSubscribe);
notificationRoutes.post("/web/unsubscribe", n.webUnsubscribe);
notificationRoutes.put("/web/prefs", n.webPrefs);
notificationRoutes.post("/tick", requireAdminSecret, n.tick);

export const appRoutes = Router();
appRoutes.get("/config", n.appConfig);
