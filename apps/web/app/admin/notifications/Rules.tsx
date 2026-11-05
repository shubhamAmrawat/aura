"use client";

import { useState } from "react";
import { saveAppVersions, saveNotificationRules, type AdminNotificationsOverview, type NotificationRules } from "@/lib/adminApi";
import { useToast } from "@/lib/toast";
import { Toggle, inputStyle } from "../_components/ui";

const AUTOS: { key: keyof NotificationRules["auto"]; label: string; sub: string; everyone: boolean }[] = [
  { key: "drop", label: "Drop is live", sub: "When a published drop starts · counts toward the cap", everyone: true },
  { key: "daily", label: "Wallpaper of the day", sub: "9:00 AM IST · only phones that turned it on", everyone: true },
  { key: "upload_live", label: "Upload approved", sub: "To the creator, right away", everyone: false },
  { key: "upload_rejected", label: "Upload not approved", sub: "With the reason you wrote", everyone: false },
  { key: "milestone", label: "Like milestones", sub: "10, 50, 100, 500, 1,000 likes · waits for quiet hours", everyone: false },
  { key: "creator", label: "Creator application decided", sub: "Approved or not, with your note", everyone: false },
  { key: "report", label: "Report reviewed", sub: "To the person who reported", everyone: false },
];

const ALERTS: { key: keyof NotificationRules["alerts"]; label: string; sub: string }[] = [
  { key: "report", label: "New report", sub: "To every admin's phone and browser" },
  { key: "application", label: "New creator application", sub: "To every admin's phone and browser" },
  { key: "deliveryProblems", label: "Push delivery problems", sub: "When more than 10% of a send fails" },
  { key: "signup", label: "New user joined", sub: "When someone makes an account (waits for quiet hours to end)" },
];

const card = { background: "var(--bg-secondary)", border: "1px solid var(--border)" };

export default function Rules({ overview, onSaved }: { overview: AdminNotificationsOverview; onSaved: () => void }) {
  const { toast } = useToast();
  const [rules, setRules] = useState<NotificationRules>(overview.rules);
  const [saving, setSaving] = useState(false);
  const [latest, setLatest] = useState(overview.versions.latest ?? "");
  const [min, setMin] = useState(overview.versions.min ?? "");
  const [savingVersions, setSavingVersions] = useState(false);
  const dirty = JSON.stringify(rules) !== JSON.stringify(overview.rules);

  const save = async () => {
    setSaving(true);
    try {
      const r = await saveNotificationRules(rules);
      setRules(r.rules);
      toast("Rules saved.", "success");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  const saveVersions = async () => {
    setSavingVersions(true);
    try {
      const r = await saveAppVersions({ latest: latest.trim() || null, min: min.trim() || null });
      setLatest(r.versions.latest ?? "");
      setMin(r.versions.min ?? "");
      toast("Saved — apps pick it up within a few minutes.", "success");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to save", "error");
    } finally {
      setSavingVersions(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-4 items-start">
      <div className="flex-[1_1_340px] flex flex-col gap-4">
        <section className="rounded-2xl p-5 flex flex-col gap-3" style={card}>
          <h2 className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>Quiet hours</h2>
          <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>Drops, the daily pick, announcements and milestones wait until the morning. Upload decisions, reports and admin alerts still go out.</p>
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
            <input type="time" value={rules.quietStart} onChange={(e) => setRules({ ...rules, quietStart: e.target.value })} className="rounded-lg px-3 py-2 text-sm [color-scheme:dark]" style={inputStyle} aria-label="Quiet from" />
            to
            <input type="time" value={rules.quietEnd} onChange={(e) => setRules({ ...rules, quietEnd: e.target.value })} className="rounded-lg px-3 py-2 text-sm [color-scheme:dark]" style={inputStyle} aria-label="Quiet until" />
            IST
          </div>
        </section>

        <section className="rounded-2xl p-5 flex flex-col gap-3" style={card}>
          <h2 className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>Daily cap</h2>
          <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>At most this many drops, daily picks, announcements and update notices per phone or browser per day. Extra ones go to the inbox only. 0 = no cap.</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setRules({ ...rules, dailyCap: Math.max(0, rules.dailyCap - 1) })} aria-label="One fewer" className="w-9 h-9 rounded-lg text-lg hover:bg-white/5" style={{ border: "1px solid var(--border-hover)", color: "var(--text-primary)" }}>−</button>
            <span className="w-12 text-center text-xl font-extrabold tabular-nums" style={{ color: "var(--text-primary)" }}>{rules.dailyCap}</span>
            <button onClick={() => setRules({ ...rules, dailyCap: Math.min(20, rules.dailyCap + 1) })} aria-label="One more" className="w-9 h-9 rounded-lg text-lg hover:bg-white/5" style={{ border: "1px solid var(--border-hover)", color: "var(--text-primary)" }}>+</button>
            <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>per day</span>
          </div>
        </section>

        <section className="rounded-2xl p-5 flex flex-col gap-1" style={card}>
          <h2 className="text-[15px] font-bold mb-1" style={{ color: "var(--text-primary)" }}>Alerts for admins</h2>
          {ALERTS.map((a) => (
            <div key={a.key}>
              <Toggle label={a.label} checked={rules.alerts[a.key]} onChange={(v) => setRules({ ...rules, alerts: { ...rules.alerts, [a.key]: v } })} />
              <p className="text-[11.5px] -mt-1 mb-1" style={{ color: "var(--text-muted)" }}>{a.sub}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl p-5 flex flex-col gap-3" style={card}>
          <h2 className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>App versions</h2>
          <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>Latest: older apps suggest updating (at most once a day). Minimum: older apps must update first — only for a broken build.</p>
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
          <button onClick={() => void saveVersions()} disabled={savingVersions} className="self-start text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-40 hover:bg-white/5" style={{ border: "1px solid var(--border-hover)", color: "var(--text-primary)" }}>
            {savingVersions ? "Saving…" : "Save versions"}
          </button>
        </section>
      </div>

      <section className="flex-[999_1_480px] min-w-0 rounded-2xl p-5 flex flex-col" style={card}>
        <h2 className="text-[15px] font-bold mb-2" style={{ color: "var(--text-primary)" }}>Automatic notifications</h2>
        {AUTOS.map((a) => (
          <div key={a.key} className="flex items-center gap-3 py-3" style={{ borderTop: "1px solid var(--border)" }}>
            <span
              className="shrink-0 w-[88px] text-center text-[11px] font-extrabold py-0.5 rounded-full"
              style={a.everyone ? { background: "rgba(255,154,60,0.14)", color: "#FFB66B" } : { background: "rgba(147,197,253,0.14)", color: "#93C5FD" }}
            >
              {a.everyone ? "EVERYONE" : "PERSONAL"}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold" style={{ color: "var(--text-primary)" }}>{a.label}</span>
              <span className="block text-[12.5px]" style={{ color: "var(--text-muted)" }}>{a.sub}</span>
            </span>
            <div className="w-12 [&>label>span:first-child]:sr-only">
              <Toggle label={a.label} checked={rules.auto[a.key]} onChange={(v) => setRules({ ...rules, auto: { ...rules.auto, [a.key]: v } })} />
            </div>
          </div>
        ))}
      </section>

      {dirty && (
        <div className="fixed bottom-4 left-0 right-0 md:left-60 z-30 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl whitespace-nowrap" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-hover)", boxShadow: "0 16px 48px rgba(0,0,0,0.5)" }}>
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>Unsaved rules</span>
            <button disabled={saving} onClick={() => setRules(overview.rules)} className="text-xs px-3 py-2 rounded-lg hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>Reset</button>
            <button disabled={saving} onClick={() => void save()} className="text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-50" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
