"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getUserNotifications, removeNotifyTarget, sendTestNotification, type UserNotifications } from "@/lib/adminApi";
import { useToast } from "@/lib/toast";

const ago = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 60) return `${Math.max(m, 1)} min ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.floor(h / 24)} days ago`;
};

function browserName(ua: string | null) {
  if (!ua) return "Browser";
  const b = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /Mac OS/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${b} on ${os}` : b;
}

const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  opened: { label: "Opened", bg: "rgba(129,238,78,0.12)", fg: "var(--accent)" },
  delivered: { label: "Delivered", bg: "rgba(147,197,253,0.14)", fg: "#93C5FD" },
  sent: { label: "Sent", bg: "rgba(255,255,255,0.08)", fg: "var(--text-secondary)" },
  queued: { label: "Waiting", bg: "rgba(255,255,255,0.08)", fg: "var(--text-secondary)" },
  capped: { label: "Inbox only", bg: "rgba(255,255,255,0.08)", fg: "var(--text-secondary)" },
  failed: { label: "Failed", bg: "rgba(239,68,68,0.14)", fg: "#F87171" },
};

const PREF_LABEL: Record<string, string> = { drops: "Drops", daily: "Daily pick", updates: "Updates", uploads: "Uploads", milestones: "Milestones", account: "Account" };
const DEFAULTS: Record<string, boolean> = { drops: true, daily: false, updates: true, uploads: true, milestones: true, account: true };

/** Admin › Users › a user: their phones and browsers, switches, and what was sent to them. */
export default function UserNotificationsPanel({ userId, isSelf }: { userId: string; isSelf: boolean }) {
  const { toast } = useToast();
  const [data, setData] = useState<UserNotifications | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    getUserNotifications(userId).then(setData).catch(() => setData(null));
  }, [userId]);
  useEffect(load, [load]);

  const remove = async (target: string) => {
    setBusy(target);
    try {
      await removeNotifyTarget(target);
      load();
      toast("Removed — it stops getting pushes until notifications are turned on there again.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy("test");
    try {
      const r = await sendTestNotification({ type: "announcement", title: "Test from Aurora", body: "If you can read this, notifications work on this device.", actions: [] });
      toast(`Test sent to ${r.campaign.sent} of your device${r.campaign.targeted === 1 ? "" : "s"}.`, "success");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setBusy(null);
    }
  };

  if (!data) return null;
  const active = [...data.phones, ...data.browsers].filter((d) => !d.disabledAt);
  const prefs: Record<string, boolean | undefined> = { ...DEFAULTS, ...(active[0]?.prefs ?? {}) };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Notifications</h3>
        <div className="flex gap-2">
          {isSelf && active.length > 0 && (
            <button disabled={busy !== null} onClick={() => void test()} className="text-xs px-3 py-1.5 rounded-lg hover:bg-white/5 disabled:opacity-40" style={{ border: "1px solid var(--border-hover)", color: "var(--text-primary)" }}>
              {busy === "test" ? "Sending…" : "Send test"}
            </button>
          )}
          <Link href={`/admin/notifications?tab=compose&user=${userId}`} className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>
            Send notification
          </Link>
        </div>
      </div>

      {data.phones.length + data.browsers.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>No phone or browser with notifications. Notifications still land in their inbox.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {data.phones.map((d) => (
            <li key={d.token} className="flex items-center gap-2 text-xs rounded-lg px-3 py-2" style={{ background: "var(--bg-primary)" }}>
              <span className="flex-1 min-w-0">
                <span className="block font-semibold truncate" style={{ color: "var(--text-primary)" }}>{d.deviceName || "Android phone"}</span>
                <span className="block truncate" style={{ color: "var(--text-muted)" }}>{d.osVersion ? `${d.osVersion} · ` : ""}app {d.appVersion ?? "?"} · {d.screen === "tablet" ? "tablet" : "phone"} · seen {ago(d.lastSeenAt)}</span>
              </span>
              <span className="px-2 py-0.5 rounded-full font-bold" style={d.disabledAt ? { background: "rgba(255,154,60,0.14)", color: "#FFB66B" } : { background: "rgba(129,238,78,0.12)", color: "var(--accent)" }}>{d.disabledAt ? "Off" : "On"}</span>
              {!d.disabledAt && (
                <button disabled={busy !== null} onClick={() => void remove(d.token)} className="px-2 py-1 rounded hover:bg-white/5 disabled:opacity-40" style={{ color: "var(--text-secondary)" }}>Remove</button>
              )}
            </li>
          ))}
          {data.browsers.map((b) => (
            <li key={b.endpoint} className="flex items-center gap-2 text-xs rounded-lg px-3 py-2" style={{ background: "var(--bg-primary)" }}>
              <span className="flex-1 min-w-0">
                <span className="block font-semibold truncate" style={{ color: "var(--text-primary)" }}>{browserName(b.userAgent)}</span>
                <span className="block truncate" style={{ color: "var(--text-muted)" }}>website · seen {ago(b.lastSeenAt)}</span>
              </span>
              <span className="px-2 py-0.5 rounded-full font-bold" style={b.disabledAt ? { background: "rgba(255,154,60,0.14)", color: "#FFB66B" } : { background: "rgba(129,238,78,0.12)", color: "var(--accent)" }}>{b.disabledAt ? "Off" : "On"}</span>
              {!b.disabledAt && (
                <button disabled={busy !== null} onClick={() => void remove(b.endpoint)} className="px-2 py-1 rounded hover:bg-white/5 disabled:opacity-40" style={{ color: "var(--text-secondary)" }}>Remove</button>
              )}
            </li>
          ))}
        </ul>
      )}

      {active.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(PREF_LABEL).map(([k, l]) => (
            <span key={k} className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={prefs[k] ? { background: "rgba(129,238,78,0.1)", color: "var(--accent)" } : { background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}>
              {l} {prefs[k] ? "on" : "off"}
            </span>
          ))}
        </div>
      )}

      {data.history.length > 0 && (
        <ul className="flex flex-col rounded-lg overflow-hidden" style={{ background: "var(--bg-primary)" }}>
          {data.history.map((h, i) => {
            const s = STATUS[h.openedAt ? "opened" : h.status] ?? STATUS.sent!;
            return (
              <li key={h.id} className="flex items-center gap-2 px-3 py-2 text-xs" style={i ? { borderTop: "1px solid var(--border)" } : undefined}>
                <span className="flex-1 min-w-0">
                  <span className="block truncate font-semibold" style={{ color: "var(--text-primary)" }}>{h.title}</span>
                  <span className="block truncate" style={{ color: "var(--text-muted)" }}>{h.kind === "test" ? "Test · " : ""}{h.channel === "web" ? "browser" : "phone"} · {ago(h.createdAt)}{h.error ? ` · ${h.error}` : ""}</span>
                </span>
                <span className="px-2 py-0.5 rounded-full font-bold whitespace-nowrap" style={{ background: s.bg, color: s.fg }}>{s.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
