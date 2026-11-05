import { route } from "../../utils/asyncRoute";
import { parseOrThrow } from "../../utils/validate";
import { AppVersionsBody, CampaignListQuery, IdParam, PreviewBody, RulesBody, SendBody, TargetBody, TemplateBody, TestBody, UserSearchQuery } from "../../validators/notification.schema";
import * as templates from "../../services/admin/notificationTemplates.service";
import * as admin from "../../services/admin/notifications.service";
import { setAppVersions } from "../../services/appConfig.service";
import { setRules } from "../../services/notify/rules";

/** GET /api/admin/notifications — phones, browsers, versions, rules */
export const overview = route("Failed to load notifications", async (_req, res) => {
  res.json(await admin.overview());
});

/** POST /api/admin/notifications/preview { audience, type } → { phones, browsers, people } */
export const preview = route("Failed to count", async (req, res) => {
  const { audience, type, templateId, cooldownDays } = parseOrThrow(PreviewBody, req.body);
  res.json(await admin.previewAudience(audience, type, templateId ?? null, cooldownDays));
});

/** POST /api/admin/notifications/send { message, audience, scheduledFor?, respectQuiet } */
export const send = route("Failed to send", async (req, res) => {
  const b = parseOrThrow(SendBody, req.body);
  res.json(
    await admin.sendManual(
      req.userId!,
      { ...b.message, body: b.message.body ?? null, imageUrl: b.message.imageUrl ?? null, url: b.message.url ?? null },
      b.audience,
      b.scheduledFor ?? null,
      b.respectQuiet,
      { templateId: b.templateId ?? null, cooldownDays: b.cooldownDays, expiresAt: b.expiresAt ?? null }
    )
  );
});

/** POST /api/admin/notifications/test { message } — to your own phones and browsers */
export const test = route("Failed to send the test", async (req, res) => {
  const { message } = parseOrThrow(TestBody, req.body);
  res.json(await admin.sendTest(req.userId!, { ...message, body: message.body ?? null, imageUrl: message.imageUrl ?? null, url: message.url ?? null }));
});

/** GET /api/admin/notifications/campaigns?filter=&limit=&offset= */
export const campaigns = route("Failed to load", async (req, res) => {
  const q = parseOrThrow(CampaignListQuery, req.query);
  res.json(await admin.listCampaigns(q.filter, q.limit, q.offset));
});

/** GET /api/admin/notifications/campaigns/:id */
export const campaign = route("Failed to load", async (req, res) => {
  const { id } = parseOrThrow(IdParam, req.params);
  res.json(await admin.campaignDetail(id));
});

/** POST /api/admin/notifications/campaigns/:id/cancel */
export const cancel = route("Failed to cancel", async (req, res) => {
  const { id } = parseOrThrow(IdParam, req.params);
  res.json(await admin.cancel(req.userId!, id));
});

/** GET /api/admin/notifications/users?q= */
export const searchUsers = route("Failed to search", async (req, res) => {
  const { q } = parseOrThrow(UserSearchQuery, req.query);
  res.json({ data: await admin.searchUsers(q) });
});

/** GET /api/admin/notifications/users/:id — phones, browsers, history */
export const user = route("Failed to load", async (req, res) => {
  const { id } = parseOrThrow(IdParam, req.params);
  res.json(await admin.userNotifications(id));
});

/** POST /api/admin/notifications/devices/remove { target } */
export const removeDevice = route("Failed to remove", async (req, res) => {
  const { target } = parseOrThrow(TargetBody, req.body);
  res.json(await admin.removeTarget(req.userId!, target));
});

/** PUT /api/admin/notifications/rules */
export const rules = route("Failed to save rules", async (req, res) => {
  res.json({ rules: await setRules(req.userId!, parseOrThrow(RulesBody, req.body)) });
});

/** PUT /api/admin/app-versions { latest, min } */
export const versions = route("Failed to save versions", async (req, res) => {
  res.json({ versions: await setAppVersions(req.userId!, parseOrThrow(AppVersionsBody, req.body)) });
});

// ─── templates ──────────────────────────────────────────────

/** GET /api/admin/notifications/templates */
export const templateList = route("Failed to load templates", async (_req, res) => {
  res.json({ data: await templates.listTemplates() });
});

/** GET /api/admin/notifications/templates/:id */
export const templateGet = route("Failed to load the template", async (req, res) => {
  const { id } = parseOrThrow(IdParam, req.params);
  res.json(await templates.getTemplate(id));
});

/** POST /api/admin/notifications/templates */
export const templateCreate = route("Failed to save the template", async (req, res) => {
  res.status(201).json(await templates.createTemplate(req.userId!, toTemplateInput(parseOrThrow(TemplateBody, req.body))));
});

/** PUT /api/admin/notifications/templates/:id */
export const templateUpdate = route("Failed to save the template", async (req, res) => {
  const { id } = parseOrThrow(IdParam, req.params);
  res.json(await templates.updateTemplate(req.userId!, id, toTemplateInput(parseOrThrow(TemplateBody, req.body))));
});

/** DELETE /api/admin/notifications/templates/:id (custom only) */
export const templateDelete = route("Failed to delete the template", async (req, res) => {
  const { id } = parseOrThrow(IdParam, req.params);
  res.json(await templates.deleteTemplate(req.userId!, id));
});

/** POST /api/admin/notifications/templates/:id/reset (built-in only) */
export const templateReset = route("Failed to reset the template", async (req, res) => {
  const { id } = parseOrThrow(IdParam, req.params);
  res.json(await templates.resetTemplate(req.userId!, id));
});

/** GET /api/admin/notifications/templates/:id/prepare — filled in, ready for Compose */
export const templatePrepare = route("Failed to use the template", async (req, res) => {
  const { id } = parseOrThrow(IdParam, req.params);
  res.json(await templates.prepareTemplate(id));
});

function toTemplateInput(b: ReturnType<typeof TemplateBody.parse>): templates.TemplateInput {
  return { ...b, description: b.description ?? null, body: b.body ?? null, imageUrl: b.imageUrl ?? null, url: b.url ?? null, bestTime: b.bestTime ?? null };
}
