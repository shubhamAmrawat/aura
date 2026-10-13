import { route } from "../../utils/asyncRoute";
import { parseOrThrow } from "../../utils/validate";
import { UserDeleteBody, UserDisableBody, UserIdParam, UserListQuery, UserPatchBody } from "../../validators/admin.schema";
import * as svc from "../../services/admin/users.service";

/** GET /api/admin/users */
export const list = route("Failed to load users", async (req, res) => {
  res.json(await svc.listUsers(parseOrThrow(UserListQuery, req.query)));
});

/** GET /api/admin/users/:id */
export const detail = route("Failed to load user", async (req, res) => {
  const { id } = parseOrThrow(UserIdParam, req.params);
  res.json(await svc.getUserDetail(id));
});

/** PATCH /api/admin/users/:id { isCreator } */
export const update = route("Failed to update user", async (req, res) => {
  const { id } = parseOrThrow(UserIdParam, req.params);
  const { isCreator } = parseOrThrow(UserPatchBody, req.body);
  res.json(await svc.setCreator(req.userId!, id, isCreator));
});

/** POST /api/admin/users/:id/unlock */
export const unlock = route("Failed to unlock user", async (req, res) => {
  const { id } = parseOrThrow(UserIdParam, req.params);
  res.json(await svc.unlockUser(req.userId!, id));
});

/** POST /api/admin/users/:id/disable { reason } */
export const disable = route("Failed to disable user", async (req, res) => {
  const { id } = parseOrThrow(UserIdParam, req.params);
  const { reason } = parseOrThrow(UserDisableBody, req.body ?? {});
  res.json(await svc.disableUser(req.userId!, id, reason));
});

/** POST /api/admin/users/:id/enable */
export const enable = route("Failed to enable user", async (req, res) => {
  const { id } = parseOrThrow(UserIdParam, req.params);
  res.json(await svc.enableUser(req.userId!, id));
});

/** DELETE /api/admin/users/:id { confirmEmail } */
export const remove = route("Failed to delete user", async (req, res) => {
  const { id } = parseOrThrow(UserIdParam, req.params);
  const { confirmEmail } = parseOrThrow(UserDeleteBody, req.body ?? {});
  res.json(await svc.deleteUser(req.userId!, id, confirmEmail));
});
