import { route } from "../../utils/asyncRoute";
import * as statsService from "../../services/admin/stats.service";
import * as dashboardService from "../../services/admin/dashboard.service";
import { parseOrThrow } from "../../utils/validate";
import { DashboardQuery } from "../../validators/admin.schema";

/** GET /api/admin/stats/overview */
export const overview = route("Failed to load stats", async (_req, res) => {
  res.json(await statsService.getOverview());
});

/** GET /api/admin/stats/dashboard?days=7|30|90 — charts + lists for the Overview page */
export const dashboard = route("Failed to load dashboard", async (req, res) => {
  const { days } = parseOrThrow(DashboardQuery, req.query);
  res.json(await dashboardService.getDashboard(days));
});
