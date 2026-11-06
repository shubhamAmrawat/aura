import { z } from "zod";
import { route } from "../../utils/asyncRoute";
import { parseOrThrow } from "../../utils/validate";
import { downloadsOverview, recentDownloads } from "../../services/admin/downloads.service";

const source = z.enum(["all", "app", "web"]).default("all");
const OverviewQuery = z.object({ range: z.enum(["today", "7d", "30d", "90d"]).default("30d"), source });
const RecentQuery = z.object({
  source,
  signedIn: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  q: z.string().trim().max(80).optional().transform((v) => v || undefined),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});

/** GET /api/admin/downloads?range=today|7d|30d|90d&source=all|app|web */
export const overview = route("Failed to load downloads", async (req, res) => {
  const q = parseOrThrow(OverviewQuery, req.query);
  res.json(await downloadsOverview(q.range, q.source));
});

/** GET /api/admin/downloads/recent?source=&signedIn=&q=&limit=&offset= */
export const recent = route("Failed to load downloads", async (req, res) => {
  res.json(await recentDownloads(parseOrThrow(RecentQuery, req.query)));
});
