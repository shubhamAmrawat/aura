import { route } from "../utils/asyncRoute";
import { authUserId } from "../utils/request";
import { parseOrThrow } from "../utils/validate";
import { getClientIp } from "../middleware/rateLimit";
import { CreateReportBody, UserIdParam } from "../validators/moderation.schema";
import { toClientSource } from "../services/wallpaper.service";
import * as svc from "../services/moderation.service";

/** POST /api/reports { targetType, targetId, reason, details? } — guests may report too. */
export const report = route("Failed to send report", async (req, res) => {
  const body = parseOrThrow(CreateReportBody, req.body);
  const result = await svc.createReport({
    ...body,
    reporterId: req.userId ?? null,
    clientKey: getClientIp(req),
    source: toClientSource(req.body?.source),
  });
  res.status(201).json({ ...result, message: "Thanks. We'll review this report." });
});

/** GET /api/blocks — creators the signed-in user has blocked */
export const listBlocks = route("Failed to load blocked accounts", async (req, res) => {
  res.json({ data: await svc.listBlocks(authUserId(req)) });
});

/** POST /api/blocks/:userId */
export const block = route("Failed to block", async (req, res) => {
  const { userId } = parseOrThrow(UserIdParam, req.params);
  res.json(await svc.blockUser(authUserId(req), userId));
});

/** DELETE /api/blocks/:userId */
export const unblock = route("Failed to unblock", async (req, res) => {
  const { userId } = parseOrThrow(UserIdParam, req.params);
  res.json(await svc.unblockUser(authUserId(req), userId));
});
