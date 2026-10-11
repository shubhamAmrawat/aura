import { route } from "../../utils/asyncRoute";
import { parseOrThrow } from "../../utils/validate";
import { BulkReviewBody, RejectBody, ReviewListQuery, WallpaperIdParam } from "../../validators/admin.schema";
import * as reviewService from "../../services/admin/review.service";

/** GET /api/admin/review?status=pending|rejected&limit&offset */
export const list = route("Failed to load review queue", async (req, res) => {
  const { status, limit, offset } = parseOrThrow(ReviewListQuery, req.query);
  res.json(await reviewService.listForReview(status, limit, offset));
});

/** POST /api/admin/review/:id/approve — approve pending, or restore rejected */
export const approve = route("Failed to approve wallpaper", async (req, res) => {
  const { id } = parseOrThrow(WallpaperIdParam, req.params);
  res.json(await reviewService.approve(req.userId!, id));
});

/** POST /api/admin/review/:id/reject { reason } */
export const reject = route("Failed to reject wallpaper", async (req, res) => {
  const { id } = parseOrThrow(WallpaperIdParam, req.params);
  const { reason } = parseOrThrow(RejectBody, req.body);
  res.json(await reviewService.reject(req.userId!, id, reason));
});

/** POST /api/admin/review/bulk { ids, action, reason? } */
export const bulk = route("Failed to update wallpapers", async (req, res) => {
  const body = parseOrThrow(BulkReviewBody, req.body);
  const reason = typeof body.reason === "string" ? body.reason.trim() : undefined;
  res.json(await reviewService.bulkReview(req.userId!, body.ids, body.action, reason));
});
