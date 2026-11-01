import { route } from "../../utils/asyncRoute";
import { parseOrThrow } from "../../utils/validate";
import { logAdminAction } from "../../utils/audit";
import { AdminBroadcastBody, AppVersionsBody } from "../../validators/notification.schema";
import { broadcast, deviceStats, recentBroadcasts } from "../../services/notification.service";
import { getAppVersions, setAppVersions } from "../../services/appConfig.service";

const PLAY_URL = "https://play.google.com/store/apps/details?id=com.shubhzx09.aurorawalls";

/** GET /api/admin/notifications — phones, recent broadcasts, app versions */
export const overview = route("Failed to load notifications", async (_req, res) => {
  const [devices, recent, versions] = await Promise.all([deviceStats(), recentBroadcasts(20), getAppVersions()]);
  res.json({ devices, recent, versions });
});

/** POST /api/admin/notifications/broadcast { type: announcement|update, title, body?, url? } */
export const send = route("Failed to send", async (req, res) => {
  const b = parseOrThrow(AdminBroadcastBody, req.body);
  const isUpdate = b.type === "update";
  const result = await broadcast({
    type: b.type,
    title: b.title,
    body: b.body,
    url: b.url ?? (isUpdate ? PLAY_URL : null),
    actions: isUpdate ? [{ id: "update", label: "Update", url: "aurora://update" }] : [],
  });
  await logAdminAction({ adminId: req.userId!, action: "notification.broadcast", targetType: "notification", targetId: result?.id, details: { type: b.type, title: b.title, pushed: result?.pushed ?? 0 } });
  res.json({ id: result?.id ?? null, pushed: result?.pushed ?? 0 });
});

/** PUT /api/admin/app-versions { latest, min } */
export const versions = route("Failed to save versions", async (req, res) => {
  res.json({ versions: await setAppVersions(req.userId!, parseOrThrow(AppVersionsBody, req.body)) });
});
