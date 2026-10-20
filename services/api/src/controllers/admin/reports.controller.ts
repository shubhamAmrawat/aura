import { route } from "../../utils/asyncRoute";
import { parseOrThrow } from "../../utils/validate";
import { AdminReportsQuery, ReportIdParam, ResolveReportBody } from "../../validators/moderation.schema";
import * as svc from "../../services/admin/reports.service";

/** GET /api/admin/reports?status=open|actioned|dismissed&limit&offset */
export const list = route("Failed to load reports", async (req, res) => {
  const { status, limit, offset } = parseOrThrow(AdminReportsQuery, req.query);
  res.json(await svc.list(status, limit, offset));
});

/** GET /api/admin/reports/counts */
export const counts = route("Failed to load counts", async (_req, res) => {
  res.json(await svc.counts());
});

/** POST /api/admin/reports/:id/resolve { status, action?, note? } */
export const resolve = route("Failed to resolve report", async (req, res) => {
  const { id } = parseOrThrow(ReportIdParam, req.params);
  const body = parseOrThrow(ResolveReportBody, req.body);
  res.json(await svc.resolve(req.userId!, id, body));
});
