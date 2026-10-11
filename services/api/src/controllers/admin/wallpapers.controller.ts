import { route } from "../../utils/asyncRoute";
import { parseOrThrow } from "../../utils/validate";
import { WallpaperBulkBody, WallpaperIdParam, WallpaperListQuery, WallpaperPatchBody } from "../../validators/admin.schema";
import * as service from "../../services/admin/wallpapers.service";

/** GET /api/admin/wallpapers */
export const list = route("Failed to load wallpapers", async (req, res) => {
  res.json(await service.listWallpapers(parseOrThrow(WallpaperListQuery, req.query)));
});

/** GET /api/admin/wallpapers/:id */
export const detail = route("Failed to load wallpaper", async (req, res) => {
  const { id } = parseOrThrow(WallpaperIdParam, req.params);
  res.json(await service.getWallpaperDetail(id));
});

/** PATCH /api/admin/wallpapers/:id */
export const update = route("Failed to update wallpaper", async (req, res) => {
  const { id } = parseOrThrow(WallpaperIdParam, req.params);
  res.json(await service.updateWallpaper(req.userId!, id, parseOrThrow(WallpaperPatchBody, req.body)));
});

/** DELETE /api/admin/wallpapers/:id */
export const remove = route("Failed to delete wallpaper", async (req, res) => {
  const { id } = parseOrThrow(WallpaperIdParam, req.params);
  res.json(await service.deleteWallpaper(req.userId!, id));
});

/** POST /api/admin/wallpapers/bulk { ids, action, categoryId?, tags? } */
export const bulk = route("Failed to update wallpapers", async (req, res) => {
  const body = parseOrThrow(WallpaperBulkBody, req.body);
  res.json(await service.bulkUpdate(req.userId!, body.ids, body.action, { categoryId: body.categoryId, tags: body.tags }));
});
