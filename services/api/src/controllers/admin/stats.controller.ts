import { route } from "../../utils/asyncRoute";
import * as statsService from "../../services/admin/stats.service";

/** GET /api/admin/stats/overview */
export const overview = route("Failed to load stats", async (_req, res) => {
  res.json(await statsService.getOverview());
});
