import { route } from "../../utils/asyncRoute";
import { parseOrThrow } from "../../utils/validate";
import { ActivityListQuery } from "../../validators/admin.schema";
import { listActivity } from "../../services/admin/activity.service";

/** GET /api/admin/activity?group=&adminId=&q=&from=&to=&limit=&offset= */
export const list = route("Failed to load activity", async (req, res) => {
  res.json(await listActivity(parseOrThrow(ActivityListQuery, req.query)));
});
