import { route } from "../utils/asyncRoute";
import { queryParam } from "../utils/request";
import { parseScreenFilter } from "../utils/screenFilter";
import * as searchService from "../services/search.service";

/** GET /api/search?q=&mode=hybrid|semantic|keyword&limit=20&offset=0&screen= */
export const search = route("Search failed", async (req, res) => {
  const q = queryParam(req, "q")?.trim();
  const limit = Math.min(Number(queryParam(req, "limit")) || 20, 50);
  const offset = Number(queryParam(req, "offset")) || 0;
  const mode = queryParam(req, "mode") || "hybrid";
  const screen = parseScreenFilter(queryParam(req, "screen"));

  if (!q || q.length < 2) {
    res.json({ data: [], hasMore: false, mode: "none" });
    return;
  }
  res.json(await searchService.search({ q, limit, offset, mode, screen }));
});

/** GET /api/search/suggestions?limit=8&screen= */
export const suggestions = route("Failed to fetch search suggestions", async (req, res) => {
  const limit = Math.min(Number(queryParam(req, "limit")) || 8, 20);
  const screen = parseScreenFilter(queryParam(req, "screen"));

  const data = await searchService.getSuggestions({ screen, limit });
  res.setHeader("Cache-Control", "public, max-age=120, s-maxage=300, stale-while-revalidate=600");
  res.json({ data });
});

/** GET /api/search/autocomplete?q=&limit=8&screen= */
export const autocomplete = route("Failed to fetch autocomplete suggestions", async (req, res) => {
  const q = queryParam(req, "q")?.trim().toLowerCase() ?? "";
  const limit = Math.min(Number(queryParam(req, "limit")) || 8, 15);
  const screen = parseScreenFilter(queryParam(req, "screen"));

  if (q.length < 2) {
    res.json({ data: [] });
    return;
  }
  const data = await searchService.getAutocomplete({ q, limit, screen });
  res.setHeader("Cache-Control", "public, max-age=30, s-maxage=60, stale-while-revalidate=120");
  res.json({ data });
});
