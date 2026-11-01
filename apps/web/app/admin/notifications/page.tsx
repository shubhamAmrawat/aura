"use client";

import { useCallback, useEffect, useState } from "react";
import { getNotificationsOverview, saveAppVersions, sendBroadcast, type AdminNotificationsOverview } from "@/lib/adminApi";
import { useToast } from "@/lib/toast";
import { ConfirmDialog, inputStyle } from "../_components/ui";

const TYPE_LABEL: Record<string, string> = {
  drop: "Drop",
  daily: "Daily pick",
  update: "App update",
  announcement: "Announcement",
};

/** Send a notification to every phone, see how many phones can get push, and set the app versions. */
export default function AdminNotificationsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<AdminNotificationsOverview | null>(null);
  const [error, setError] = useState("");
  const [type, setType] = useState<"announcement" | "update">("update");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [latest, setLatest] = useState("");
  const [min, setMin] = useState("");
  const [savingVersions, setSavingVersions] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await getNotificationsOverview();
      setData(d);
      setLatest(d.versions.latest ?? "");
      setMin(d.versions.min ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  /** announcements and updates both go to phones with "App updates" on */
  const audience = data?.devices.updates;

  const send = async () => {
    setSending(true);
    try {
      const r = await sendBroadcast({ type, title: title.trim(), body: body.trim() || undefined, url: url.trim() || undefined });
      setConfirm(false);
      setTitle("");
      setBody("");
      setUrl("");
      toast(`Sent to ${r.pushed} phone${r.pushed === 1 ? "" : "s"} · also in everyone's inbox.`, "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to send", "error");
    } finally {
      setSending(false);
    }
  };

  const saveVersions = async () => {
    setSavingVersions(true);
    try {
      const r = await saveAppVersions({ latest: latest.trim() || null, min: min.trim() || null });
      setLatest(r.versions.latest ?? "");
      setMin(r.versions.min ?? "");
      toast("Saved — apps pick it up within a few minutes.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to save", "error");
    } finally {
      setSavingVersions(false);
    }
  };

  const card = { background: "var(--bg-secondary)", border: "1px solid var(--border)" };

  return (
    <div className="pb-24">
      <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Notifications</h1>
      <p className="text-sm mt-1 max-w-2xl" style={{ color: "var(--text-secondary)" }}>
        Drops, the daily pick, upload decisions and reports send on their own. Use this page for one-off messages and app updates.
      </p>
      {error && <p className="mt-6 text-sm px-4 py-3 rounded-lg" style={{ color: "#ef4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>{error}</p>}

      {data && (
        <div className="mt-6 grid gap-3 grid-cols-2 md:grid-cols-4">
          {[
            ["Phones with push", data.devices.total],
            ["Signed in", data.devices.signedIn],
            ["Want drops", data.devices.drops],
            ["Want the daily pick", data.devices.daily],
          ].map(([label, n]) => (
            <div key={label} className="rounded-xl p-4" style={card}>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
              <p className="text-2xl font-bold tabular-nums mt-1" style={{ color: "var(--text-primary)" }}>{n}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-2 items-start">
        {/* Compose */}
        <section className="rounded-xl p-5 flex flex-col gap-3" style={card}>
          <p className="font-semibold" style={{ color: "var(--text-primary)" }}>Send a notification</p>
          <div role="radiogroup" aria-label="Type" className="inline-flex self-start p-1 rounded-lg" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
            {(["update", "announcement"] as const).map((t) => (
              <button
                key={t}
                role="radio"
                aria-checked={type === t}
                onClick={() => setType(t)}
                className="text-sm font-semibold px-3 py-1.5 rounded-md"
                style={type === t ? { background: "var(--accent)", color: "var(--bg-primary)" } : { color: "var(--text-secondary)" }}
              >
                {t === "update" ? "App update" : "Announcement"}
              </button>
            ))}
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {type === "update"
              ? "Has an Update button that starts the update inside the app (Play installs), or opens the Play Store."
              : "A message to everyone. Optional link: a path like /collection/… or an https link."}
          </p>
          <label className="flex flex-col gap-1.5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
            Title
            <input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder={type === "update" ? "Aurora 1.0.2 is ready" : "Something new on Aurora"} className="rounded-lg px-3 py-2 text-sm font-normal" style={inputStyle} />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
            Message
            <textarea value={body} maxLength={200} rows={3} onChange={(e) => setBody(e.target.value)} placeholder={type === "update" ? "Notifications, faster loading and bug fixes." : ""} className="rounded-lg px-3 py-2 text-sm font-normal resize-none" style={inputStyle} />
          </label>
          {type === "announcement" && (
            <label className="flex flex-col gap-1.5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              Link (optional)
              <input value={url} maxLength={300} onChange={(e) => setUrl(e.target.value)} placeholder="/collection/… or https://…" className="rounded-lg px-3 py-2 text-sm font-normal" style={inputStyle} />
            </label>
          )}
          <button onClick={() => setConfirm(true)} disabled={!title.trim()} className="self-start text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-40" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>
            Send…
          </button>
        </section>

        {/* Versions */}
        <section className="rounded-xl p-5 flex flex-col gap-3" style={card}>
          <p className="font-semibold" style={{ color: "var(--text-primary)" }}>App versions</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Latest: apps older than this suggest updating. Minimum: apps older than this must update before they can be used (only for a broken build). Leave empty to switch off.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              Latest
              <input value={latest} onChange={(e) => setLatest(e.target.value)} placeholder="1.0.2" className="rounded-lg px-3 py-2 text-sm font-normal" style={inputStyle} />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              Minimum
              <input value={min} onChange={(e) => setMin(e.target.value)} placeholder="empty" className="rounded-lg px-3 py-2 text-sm font-normal" style={inputStyle} />
            </label>
          </div>
          <button onClick={saveVersions} disabled={savingVersions} className="self-start text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-40" style={{ border: "1px solid var(--border-hover)", color: "var(--text-primary)" }}>
            {savingVersions ? "Saving…" : "Save versions"}
          </button>
        </section>
      </div>

      {/* Recent */}
      {data && (
        <section className="mt-6">
          <p className="font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Recent broadcasts</p>
          {data.recent.length === 0 ? (
            <p className="text-sm py-8 text-center rounded-xl" style={{ color: "var(--text-muted)", border: "1px dashed var(--border-hover)" }}>Nothing sent yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.recent.map((n) => (
                <li key={n.id} className="flex items-center gap-3 rounded-xl px-4 py-3" style={card}>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}>{TYPE_LABEL[n.type] ?? n.type}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm truncate" style={{ color: "var(--text-primary)" }}>{n.title}</span>
                    {n.body && <span className="block text-xs truncate" style={{ color: "var(--text-muted)" }}>{n.body}</span>}
                  </span>
                  <span className="text-xs tabular-nums whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{n.pushed} phones · {new Date(n.createdAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {confirm && (
        <ConfirmDialog
          title="Send to everyone?"
          body={<>“{title.trim()}” goes to {audience ?? 0} phone{audience === 1 ? "" : "s"} that allow app updates and news, and into everyone&apos;s inbox. It can&apos;t be unsent.</>}
          confirmLabel="Send"
          busy={sending}
          onCancel={() => setConfirm(false)}
          onConfirm={send}
        />
      )}
    </div>
  );
}
