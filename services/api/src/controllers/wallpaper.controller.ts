import { route } from "../utils/asyncRoute";
import { authUserId, param, queryParam } from "../utils/request";
import { parseScreenFilter } from "../utils/screenFilter";
import { parseOrThrow } from "../utils/validate";
import { UploadBody, UploadUrlBody } from "../validators/wallpaper.schema";
import { recalculateTrendingScores } from "../jobs/trending.job";
import * as wallpaperService from "../services/wallpaper.service";

/** GET /api/wallpapers?featured=true&limit=20&offset=0&category=nature&q=forest&screen=mobile */
export const list = route("Failed to fetch wallpapers", async (req, res) => {
  const limitParam = queryParam(req, "limit");
  let limit: number;
  if (limitParam === undefined || limitParam === "") {
    limit = 150;
  } else {
    const n = Number(limitParam);
    limit = Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 100) : 30;
  }
  const screen = parseScreenFilter(queryParam(req, "screen"));
  const offset = Number(queryParam(req, "offset")) || 0;

  const data = await wallpaperService.listWallpapers({
    featured: queryParam(req, "featured") === "true",
    limit,
    offset,
    categorySlug: queryParam(req, "category")?.trim(),
    q: queryParam(req, "q")?.trim(),
    screen,
  });

  res.setHeader("Cache-Control", "no-store");
  res.json({ data, count: data.length, hasMore: data.length === limit });
});

/** GET /api/wallpapers/trending?limit=50&offset=0&screen=mobile */
export const trending = route("Failed to fetch trending wallpapers", async (req, res) => {
  const limit = Math.min(Number(queryParam(req, "limit")) || 50, 100);
  const offset = Number(queryParam(req, "offset")) || 0;
  const screen = parseScreenFilter(queryParam(req, "screen"));

  const data = await wallpaperService.listTrending({ limit, offset, screen });

  res.setHeader("Cache-Control", "no-store");
  res.json({ data, count: data.length, hasMore: data.length === limit });
});

/** GET /api/wallpapers/:id */
export const getOne = route("Failed to fetch wallpapers", async (req, res) => {
  const data = await wallpaperService.getWallpaper(param(req, "id"));
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
  res.json({ data });
});

/** GET /api/wallpapers/:id/similar?limit=24&offset=0&screen=mobile */
export const similar = route("Failed to fetch similar wallpapers", async (req, res) => {
  const limit = Math.min(Number(queryParam(req, "limit")) || 24, 50);
  const offset = Math.max(0, Math.floor(Number(queryParam(req, "offset")) || 0));
  const screen = parseScreenFilter(queryParam(req, "screen"));

  const result = await wallpaperService.getSimilar(param(req, "id"), { limit, offset, screen });
  if (!result) {
    res.json({ data: [], hasMore: false });
    return;
  }
  res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=3600");
  res.json(result);
});

/** POST /api/wallpapers/:id/download — body (optional): { quality } */
export const trackDownload = route("Failed to track download", async (req, res) => {
  const quality = typeof req.body?.quality === "string" && req.body.quality.trim() ? req.body.quality.trim() : "original";
  await wallpaperService.trackDownload(param(req, "id"), req.userId, quality);
  res.json({ message: "Download tracked" });
});

/** POST /api/wallpapers/:id/view */
export const trackView = route("Failed to track view", async (req, res) => {
  await wallpaperService.trackView(param(req, "id"));
  res.json({ message: "View tracked" });
});

/** POST /api/wallpapers/upload-url → presigned R2 PUT URL */
export const uploadUrl = route("Failed to generate upload URL", async (req, res) => {
  const { fileType } = parseOrThrow(UploadUrlBody, req.body);
  const { uploadUrl, fileUrl, key } = await wallpaperService.createUploadUrl(authUserId(req), fileType);
  res.json({ uploadUrl, fileUrl, key });
});

/** POST /api/wallpapers/upload — create the wallpaper after the client PUT the file to R2 */
export const upload = route("Failed to upload wallpaper", async (req, res) => {
  const userId = authUserId(req);
  await wallpaperService.assertCreator(userId); // before body validation, as before
  await wallpaperService.assertUploadQuota(userId);
  const input = parseOrThrow(UploadBody, req.body);

  const result = await wallpaperService.createWallpaperFromUpload(userId, input);
  if (result.kind === "rejected") {
    res.status(422).json({
      error: result.reason || "Image violates content policy",
      moderationStatus: "rejected",
    });
    return;
  }

  res.json({
    wallpaper: result.wallpaper,
    moderationStatus: result.moderationStatus,
    message:
      result.moderationStatus === "approved"
        ? "Wallpaper uploaded and live!"
        : "Wallpaper uploaded and under review",
  });
});

/** POST /api/wallpapers/trending/recalculate (X-Admin-Secret) */
export const recalculateTrending = route("Failed to recalculate", async (_req, res) => {
  const result = await recalculateTrendingScores();
  res.json({ message: "Trending scores recalculated", ...result });
});

/** POST /api/wallpapers/reembed-text (X-Admin-Secret) */
export const reembedText = route("Reembed failed", async (_req, res) => {
  res.json(await wallpaperService.reembedMissingText());
});
