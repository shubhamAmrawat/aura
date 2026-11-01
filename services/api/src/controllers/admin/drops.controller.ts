import { route } from "../../utils/asyncRoute";
import { parseOrThrow } from "../../utils/validate";
import { CreateDropBody, DropIdParam, DropItemsBody, UpdateDropBody } from "../../validators/drop.schema";
import * as drops from "../../services/drop.service";

/** GET /api/admin/drops */
export const list = route("Failed to load drops", async (_req, res) => {
  res.json(await drops.adminListDrops());
});

/** GET /api/admin/drops/:id — drop + all its wallpapers (any status) */
export const detail = route("Failed to load drop", async (req, res) => {
  const { id } = parseOrThrow(DropIdParam, req.params);
  res.json(await drops.adminGetDrop(id));
});

/** POST /api/admin/drops { title, description?, startsAt?, endsAt?, showOnApp?, showOnWeb?, published? } */
export const create = route("Failed to create drop", async (req, res) => {
  res.status(201).json(await drops.adminCreateDrop(req.userId!, parseOrThrow(CreateDropBody, req.body)));
});

/** PATCH /api/admin/drops/:id — any of the create fields */
export const update = route("Failed to save drop", async (req, res) => {
  const { id } = parseOrThrow(DropIdParam, req.params);
  res.json(await drops.adminUpdateDrop(req.userId!, id, parseOrThrow(UpdateDropBody, req.body)));
});

/** PUT /api/admin/drops/:id/wallpapers { ids } — the full ordered list */
export const items = route("Failed to save wallpapers", async (req, res) => {
  const { id } = parseOrThrow(DropIdParam, req.params);
  const { ids } = parseOrThrow(DropItemsBody, req.body);
  res.json(await drops.adminSetDropItems(req.userId!, id, ids));
});

/** DELETE /api/admin/drops/:id */
export const remove = route("Failed to delete drop", async (req, res) => {
  const { id } = parseOrThrow(DropIdParam, req.params);
  res.json(await drops.adminDeleteDrop(req.userId!, id));
});
