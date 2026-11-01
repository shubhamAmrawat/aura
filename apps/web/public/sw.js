/* Aurora website notifications (Web Push). Registered by lib/webPush.ts as /sw.js?api=<API URL>. */
const API = new URL(self.location.href).searchParams.get("api") || "";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Aurora", body: event.data ? event.data.text() : "" };
  }
  const buttons = Array.isArray(data.buttons) ? data.buttons : [];
  // app-only buttons (the wallpaper changer, the app update) mean nothing on the website
  const webButtons = buttons.filter((b) => b && b.url && toPath(b.url) !== null).slice(0, 2);
  event.waitUntil(
    self.registration.showNotification(data.title || "Aurora", {
      body: data.body || "",
      icon: "/icon.png",
      image: data.image || undefined,
      tag: data.did || data.tag || undefined,
      data: { url: data.url || null, did: data.did || null, actions: Object.fromEntries(webButtons.map((b) => [b.id, b.url])) },
      actions: webButtons.map((b) => ({ action: b.id, title: b.label })),
    })
  );
});

/** Where a notification link goes on the website (null = nowhere sensible). */
function toPath(url) {
  if (!url) return "/notifications";
  if (url.startsWith("https://")) return url;
  if (/^\/(wallpaper|collection|category)\//.test(url)) return url.split("?")[0];
  if (url === "/notifications") return url;
  return null;
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const d = event.notification.data || {};
  const action = event.action || "tap";
  const raw = action === "tap" ? d.url : (d.actions || {})[action];
  const target = toPath(raw) || "/notifications";
  const report =
    d.did && API
      ? fetch(`${API}/api/notifications/opened`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ d: d.did, a: action }),
        }).catch(() => undefined)
      : Promise.resolve();
  event.waitUntil(Promise.all([report, self.clients.openWindow(target)]));
});
