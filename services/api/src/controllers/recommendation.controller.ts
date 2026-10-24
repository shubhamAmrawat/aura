import { route } from "../utils/asyncRoute";
import { queryParam } from "../utils/request";
import { parseScreenFilter } from "../utils/screenFilter";
import * as recommendationService from "../services/recommendation.service";

/**
 * GET /api/wallpapers/feed?limit=24&offset=0&screen=mobile&guestIds=id1,id2
 * Personalized content-based wallpaper feed
 */
export const getFeed = route("Failed to fetch personalized feed", async (req, res) => {
  const limitParam = queryParam(req, "limit");
  const limit = Math.min(Number(limitParam) || 24, 60);
  const offset = Math.max(0, Number(queryParam(req, "offset")) || 0);
  const screen = parseScreenFilter(queryParam(req, "screen"));

  // Optional guest IDs passed in query or custom header for anonymous session personalization
  const guestQuery = queryParam(req, "guestIds") || req.get("X-Session-Interactions") || "";
  const guestIds = guestQuery
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const result = await recommendationService.getPersonalizedFeed({
    userId: req.userId || null,
    guestIds,
    screen,
    limit,
    offset,
  });

  res.setHeader("Cache-Control", "no-store");
  res.json({
    data: result.data,
    count: result.data.length,
    hasMore: result.hasMore,
    profile: result.profile,
  });
});
