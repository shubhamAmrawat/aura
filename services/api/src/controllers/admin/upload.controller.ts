import { route } from "../../utils/asyncRoute";
import { parseOrThrow } from "../../utils/validate";
import { AdminUploadBody, UploadUrlsBody } from "../../validators/admin.schema";
import * as uploads from "../../services/admin/upload.service";

/** POST /api/admin/uploads/urls { files: [{ fileType, fileSizeBytes }] } → presigned PUTs (same order) */
export const urls = route("Failed to prepare uploads", async (req, res) => {
  const { files } = parseOrThrow(UploadUrlsBody, req.body);
  res.json(await uploads.createUploadUrls(req.userId!, files));
});

/** POST /api/admin/uploads — create one wallpaper from a file already PUT to R2 */
export const create = route("Failed to create wallpaper", async (req, res) => {
  const input = parseOrThrow(AdminUploadBody, req.body);
  res.status(201).json(await uploads.createAdminUpload(req.userId!, input));
});
