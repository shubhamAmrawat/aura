import { route } from "../../utils/asyncRoute";
import { parseOrThrow } from "../../utils/validate";
import { param } from "../../utils/request";
import { CategoryCreateBody, CategoryDeleteQuery, CategoryOrderBody, CategoryPatchBody } from "../../validators/admin.schema";
import * as cats from "../../services/admin/categories.service";
import { ApiError } from "../../utils/ApiError";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const idParam = (req: Parameters<typeof param>[0]) => {
  const id = param(req, "id");
  if (!UUID.test(id)) throw new ApiError(404, "Category not found");
  return id;
};

/** GET /api/admin/categories — every category with counts and a preview image */
export const list = route("Failed to load categories", async (_req, res) => {
  res.json(await cats.listAdminCategories());
});

/** POST /api/admin/categories { name, slug?, description? } */
export const create = route("Failed to create category", async (req, res) => {
  const body = parseOrThrow(CategoryCreateBody, req.body);
  res.status(201).json(await cats.createCategory(req.userId!, body));
});

/** PATCH /api/admin/categories/:id { name?, slug?, description?, coverImageUrl? } */
export const update = route("Failed to update category", async (req, res) => {
  const id = idParam(req);
  const body = parseOrThrow(CategoryPatchBody, req.body);
  res.json(await cats.updateCategory(req.userId!, id, body));
});

/** PUT /api/admin/categories/order { ids } */
export const order = route("Failed to save order", async (req, res) => {
  const { ids } = parseOrThrow(CategoryOrderBody, req.body);
  res.json(await cats.reorderCategories(req.userId!, ids));
});

/** DELETE /api/admin/categories/:id?moveTo=<id> */
export const remove = route("Failed to delete category", async (req, res) => {
  const id = idParam(req);
  const { moveTo } = parseOrThrow(CategoryDeleteQuery, req.query);
  res.json(await cats.deleteCategory(req.userId!, id, moveTo));
});
