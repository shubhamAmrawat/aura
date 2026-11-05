import { route } from "../utils/asyncRoute";
import { authUserId } from "../utils/request";
import { parseOrThrow } from "../utils/validate";
import { isExpoPushToken } from "../integrations/expoPush";
import { ApiError } from "../utils/ApiError";
import { DevicePrefsBody, InboxQuery, SeenQuery, OpenedBody, RegisterDeviceBody, TokenBody, TokenQuery, WebEndpointBody, WebPrefsBody, WebSubscribeBody } from "../validators/notification.schema";
import { markOpened } from "../services/notify/engine";
import { vapidPublicKey } from "../integrations/webPush";
import * as notify from "../services/notification.service";
import { runNotificationTick } from "../services/notificationTriggers.service";
import { getAppVersions } from "../services/appConfig.service";

/** GET /api/notifications?screen=&since=&before=&limit= — signed in: own + broadcasts; signed out: broadcasts */
export const inbox = route("Failed to load notifications", async (req, res) => {
  const q = parseOrThrow(InboxQuery, req.query);
  res.json(await notify.listInbox({ userId: req.userId, screen: q.screen ?? null, since: q.since, before: q.before, limit: q.limit, scope: q.scope }));
});

/** GET /api/notifications/unread?screen=&since= */
export const unread = route("Failed to load notifications", async (req, res) => {
  const q = parseOrThrow(InboxQuery, req.query);
  res.json(await notify.unreadCount({ userId: req.userId, screen: q.screen ?? null, since: q.since, scope: q.scope }));
});

/** POST /api/notifications/seen?scope= — the inbox (or the admin bell, scope=admin) was opened */
export const seen = route("Failed to update notifications", async (req, res) => {
  const { scope } = parseOrThrow(SeenQuery, req.query);
  res.json(await notify.markSeen(authUserId(req), scope === "admin"));
});

/** POST /api/notifications/devices { token, screen, platform, appVersion } — signed in links the phone to the account */
export const registerDevice = route("Failed to register device", async (req, res) => {
  const b = parseOrThrow(RegisterDeviceBody, req.body);
  if (!isExpoPushToken(b.token)) throw new ApiError(400, "Invalid token");
  res.json(
    await notify.registerDevice({
      token: b.token,
      userId: req.userId ?? null,
      screen: b.screen,
      platform: b.platform,
      appVersion: b.appVersion ?? null,
      deviceName: b.deviceName ?? null,
      osVersion: b.osVersion ?? null,
    })
  );
});

/** GET /api/notifications/devices/prefs?token= */
export const getPrefs = route("Failed to load settings", async (req, res) => {
  const { token } = parseOrThrow(TokenQuery, req.query);
  res.json(await notify.getDevicePrefs(token));
});

/** PUT /api/notifications/devices/prefs { token, prefs } */
export const setPrefs = route("Failed to save settings", async (req, res) => {
  const { token, prefs } = parseOrThrow(DevicePrefsBody, req.body);
  res.json(await notify.setDevicePrefs(token, prefs));
});

/** POST /api/notifications/devices/disable { token } — notifications were turned off on the phone */
export const disableDevice = route("Failed to update device", async (req, res) => {
  const { token } = parseOrThrow(TokenBody, req.body);
  await notify.disableDevice(token);
  res.json({ ok: true });
});

/** POST /api/notifications/tick — X-Admin-Secret; called by the scheduled GitHub Action */
export const tick = route("Tick failed", async (_req, res) => {
  res.json(await runNotificationTick());
});

/** GET /api/app/config — versions for the app's update prompt */
export const appConfig = route("Failed to load config", async (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=300");
  res.json({ versions: await getAppVersions() });
});

/** POST /api/notifications/opened { d, a } — a push (or one of its buttons) was tapped */
export const opened = route("Failed", async (req, res) => {
  const { d, a } = parseOrThrow(OpenedBody, req.body);
  res.json(await markOpened(d, a ?? null));
});

/** GET /api/notifications/web/key — the VAPID public key (null = website notifications are off) */
export const webKey = route("Failed", async (_req, res) => {
  res.json({ key: vapidPublicKey() });
});

/** POST /api/notifications/web/subscribe — the browser's PushSubscription (linked to the account when signed in) */
export const webSubscribe = route("Failed to turn on notifications", async (req, res) => {
  const b = parseOrThrow(WebSubscribeBody, req.body);
  res.json(
    await notify.subscribeWeb({
      endpoint: b.endpoint,
      p256dh: b.keys.p256dh,
      auth: b.keys.auth,
      userId: req.userId ?? null,
      userAgent: (req.get("user-agent") ?? "").slice(0, 200) || null,
    })
  );
});

/** POST /api/notifications/web/unsubscribe { endpoint } */
export const webUnsubscribe = route("Failed", async (req, res) => {
  const { endpoint } = parseOrThrow(WebEndpointBody, req.body);
  res.json(await notify.unsubscribeWeb(endpoint));
});

/** PUT /api/notifications/web/prefs { endpoint, prefs } */
export const webPrefs = route("Failed to save", async (req, res) => {
  const { endpoint, prefs } = parseOrThrow(WebPrefsBody, req.body);
  res.json(await notify.setWebPrefs(endpoint, prefs));
});
