import { route } from "../utils/asyncRoute";
import { authUserId } from "../utils/request";
import { parseOrThrow } from "../utils/validate";
import { IdParam, SampleConfirmBody, SampleUrlBody, SubmitApplicationBody } from "../validators/creator.schema";
import * as creator from "../services/creatorApplication.service";

/** GET /api/creator/application — status, latest application, rules */
export const status = route("Failed to load your application", async (req, res) => {
  res.json(await creator.getStatus(authUserId(req)));
});

/** POST /api/creator/samples/upload-url { fileType, size } */
export const sampleUploadUrl = route("Failed to start the upload", async (req, res) => {
  const { fileType, size } = parseOrThrow(SampleUrlBody, req.body);
  res.json(await creator.sampleUploadUrl(authUserId(req), fileType, size));
});

/** POST /api/creator/samples { key } — after the upload: checks the image, makes its preview */
export const addSample = route("Failed to add the image", async (req, res) => {
  const { key } = parseOrThrow(SampleConfirmBody, req.body);
  res.json({ sample: await creator.addSample(authUserId(req), key) });
});

/** DELETE /api/creator/samples/:id — an unsent sample */
export const removeSample = route("Failed to remove the image", async (req, res) => {
  const { id } = parseOrThrow(IdParam, req.params);
  await creator.removeSample(authUserId(req), id);
  res.json({ ok: true });
});

/** POST /api/creator/application { sampleIds, about?, portfolioUrl? } */
export const submit = route("Failed to send your application", async (req, res) => {
  const body = parseOrThrow(SubmitApplicationBody, req.body);
  res.json(await creator.submit(authUserId(req), body));
});
