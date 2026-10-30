import { route } from "../utils/asyncRoute";
import { queryParam } from "../utils/request";
import { parseScreenFilter } from "../utils/screenFilter";
import * as daily from "../services/daily.service";

/** GET /api/wallpapers/daily?screen=mobile|tablet (default mobile) */
export const getDaily = route("Failed to fetch the wallpaper of the day", async (req, res) => {
  const screen = parseScreenFilter(queryParam(req, "screen")) ?? "mobile";
  const result = await daily.getDailyWallpaper(screen);
  // Same answer for everyone until midnight IST; a short cache keeps it fresh around the change.
  res.setHeader("Cache-Control", "public, max-age=300");
  res.json(result);
});
