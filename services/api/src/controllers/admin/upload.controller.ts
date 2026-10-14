import { route } from "../../utils/asyncRoute";
import { parseOrThrow } from "../../utils/validate";
import { AdminUploadBody, UploadAnalyzeBody, UploadDiscardBody, UploadUrlsBody } from "../../validators/admin.schema";
import * as uploads from "../../services/admin/upload.service";

/** POST /api/admin/uploads/urls { files: [{ fileType, fileSizeBytes }] } → presigned PUTs (same order) */
export const urls = route("Failed to prepare uploads", async (req, res) => {
  const { files } = parseOrThrow(UploadUrlsBody, req.body);
  res.json(await uploads.createUploadUrls(req.userId!, files));
});

/** POST /api/admin/uploads/analyze — read + AI-analyse a file already in R2; returns the draft to review */
export const analyze = route("Failed to analyse the image", async (req, res) => {
  const input = parseOrThrow(UploadAnalyzeBody, req.body);
  res.json(await uploads.analyzeAdminUpload(req.userId!, input));
});

/** POST /api/admin/uploads/discard { key } — drop a draft and delete its file */
export const discard = route("Failed to remove the file", async (req, res) => {
  const { key } = parseOrThrow(UploadDiscardBody, req.body);
  res.json(await uploads.discardAdminUpload(req.userId!, key));
});

/** POST /api/admin/uploads — publish one wallpaper (from its draft, with the admin's edits) */
export const create = route("Failed to create wallpaper", async (req, res) => {
  const input = parseOrThrow(AdminUploadBody, req.body);
  res.status(201).json(await uploads.createAdminUpload(req.userId!, input));
});
