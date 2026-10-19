import { route } from "../../utils/asyncRoute";
import { parseOrThrow } from "../../utils/validate";
import { AdminApplicationsQuery, ApproveBody, IdParam, RejectApplicationBody } from "../../validators/creator.schema";
import * as svc from "../../services/admin/creatorApplications.service";

/** GET /api/admin/creator-applications?status=pending|approved|rejected */
export const list = route("Failed to load applications", async (req, res) => {
  const { status, limit, offset } = parseOrThrow(AdminApplicationsQuery, req.query);
  res.json(await svc.list(status, limit, offset));
});

/** GET /api/admin/creator-applications/counts — for the sidebar badge */
export const counts = route("Failed to load counts", async (_req, res) => {
  res.json(await svc.counts());
});

/** GET /api/admin/creator-applications/:id */
export const detail = route("Failed to load application", async (req, res) => {
  const { id } = parseOrThrow(IdParam, req.params);
  res.json(await svc.detail(id));
});

/** POST /api/admin/creator-applications/:id/approve { note? } */
export const approve = route("Failed to approve", async (req, res) => {
  const { id } = parseOrThrow(IdParam, req.params);
  const { note } = parseOrThrow(ApproveBody, req.body);
  res.json(await svc.approve(req.userId!, id, note));
});

/** POST /api/admin/creator-applications/:id/reject { note } */
export const reject = route("Failed to reject", async (req, res) => {
  const { id } = parseOrThrow(IdParam, req.params);
  const { note } = parseOrThrow(RejectApplicationBody, req.body);
  res.json(await svc.reject(req.userId!, id, note));
});

/** POST /api/admin/creator-applications/:id/rescore — run the AI pre-screen again */
export const rescore = route("Failed to score the application", async (req, res) => {
  const { id } = parseOrThrow(IdParam, req.params);
  res.json(await svc.rescore(id));
});
