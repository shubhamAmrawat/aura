import { route } from "../../utils/asyncRoute";
import { parseOrThrow } from "../../utils/validate";
import { SuggestionApplyBody, SuggestionDismissBody, SuggestionListQuery } from "../../validators/admin.schema";
import * as svc from "../../services/admin/categorySuggestions.service";

/** GET /api/admin/categories/suggestions?kind=uncategorized|moves */
export const list = route("Failed to load suggestions", async (req, res) => {
  const { kind } = parseOrThrow(SuggestionListQuery, req.query);
  res.json(await svc.listSuggestions(kind));
});

/** POST /api/admin/categories/suggestions/apply { items: [{ wallpaperId, categoryId }] } */
export const apply = route("Failed to apply suggestions", async (req, res) => {
  const { items } = parseOrThrow(SuggestionApplyBody, req.body);
  res.json(await svc.applySuggestions(req.userId!, items));
});

/** POST /api/admin/categories/suggestions/dismiss { wallpaperIds } */
export const dismiss = route("Failed to dismiss suggestions", async (req, res) => {
  const { wallpaperIds } = parseOrThrow(SuggestionDismissBody, req.body);
  res.json(await svc.dismissSuggestions(req.userId!, wallpaperIds));
});
