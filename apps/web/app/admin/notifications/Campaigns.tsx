"use client";

import { useCallback, useEffect, useState } from "react";
import { cancelCampaign, getCampaign, listCampaigns, type CampaignDetail, type CampaignRow } from "@/lib/adminApi";
import { useToast } from "@/lib/toast";
import { ConfirmDialog } from "../_components/ui";

type Filter = "all" | "manual" | "auto" | "scheduled";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "manual", label: "Sent by admins" },
  { key: "auto", label: "Automatic" },
  { key: "scheduled", label: "Scheduled" },
];

const TYPE_LABEL: Record<string, string> = {
  drop: "Drop", daily: "Daily pick", update: "App update", announcement: "Announcement",
  upload_live: "Upload approved", upload_rejected: "Upload not approved", milestone: "Milestone",
  creator_approved: "Creator approved", creator_rejected: "Creator not approved", report_reviewed: "Report reviewed",
  admin_report: "Admin alert", admin_application: "Admin alert", admin_delivery: "Admin alert",
};

const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  scheduled: { label: "Scheduled", bg: "rgba(96,165,250,0.15)", fg: "#93C5FD" },
  held: { label: "Held", bg: "rgba(255,255,255,0.08)", fg: "var(--text-secondary)" },
  sending: { label: "Sending", bg: "rgba(255,154,60,0.15)", fg: "#FFB66B" },
  sent: { label: "Sent", bg: "rgba(129,238,78,0.12)", fg: "var(--accent)" },
  cancelled: { label: "Cancelled", bg: "rgba(255,255,255,0.06)", fg: "var(--text-muted)" },
};

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : "—");

function audienceLabel(c: CampaignRow) {
  const a = c.audience as { kind: string; userIds?: string[]; targets?: string[]; screen?: string | null; versionBelow?: string | null };
  const base: Record<string, string> = {
    everyone: "Everyone", signedIn: "Signed in", signedOut: "Signed out", creators: "Creators", admins: "Admins",
    users: `${a.userIds?.length ?? 0} ${a.userIds?.length === 1 ? "person" : "people"}`,
    devices: `${a.targets?.length ?? 0} device${a.targets?.length === 1 ? "" : "s"}`,
  };
  return [base[a.kind] ?? a.kind, a.screen === "mobile" ? "phones" : a.screen === "tablet" ? "tablets" : null, a.versionBelow ? `older than ${a.versionBelow}` : null].filter(Boolean).join(" · ");
}

function Badge({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.sent!;
  return <span className="text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: s.bg, color: s.fg }}>{s.label}</span>;
}

export default function Campaigns({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string | null) => void }) {
  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [rows, setRows] = useState<CampaignRow[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await listCampaigns(filter);
      setRows(r.data);
      setHasMore(r.hasMore);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load", "error");
    }
  }, [filter, toast]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let alive = true;
    getCampaign(selectedId).then((d) => alive && setDetail(d)).catch(() => alive && setDetail(null));
    return () => { alive = false; };
  }, [selectedId]);

  // keep numbers fresh while something is going out or waiting for receipts
  useEffect(() => {
    const live = rows?.some((r) => r.status === "sending" || (r.status === "sent" && r.finishedAt && Date.now() - new Date(r.finishedAt).getTime() < 30 * 60_000));
    if (!live) return;
    const t = setInterval(() => {
      void load();
      if (selectedId) getCampaign(selectedId).then(setDetail).catch(() => undefined);
    }, 15_000);
    return () => clearInterval(t);
  }, [rows, load, selectedId]);

  const more = async () => {
    try {
      const r = await listCampaigns(filter, rows?.length ?? 0);
      setRows((prev) => [...(prev ?? []), ...r.data]);
      setHasMore(r.hasMore);
    } catch { /* keep */ }
  };

  const doCancel = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      setDetail(await cancelCampaign(detail.campaign.id));
      setConfirmCancel(false);
      toast("Cancelled.", "success");
      void load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to cancel", "error");
    } finally {
      setBusy(false);
    }
  };

  const c = detail?.campaign;
  const funnel = c
    ? [
        { label: "Targeted", value: c.targeted, of: c.targeted, color: "#5A5753" },
        { label: "Sent", value: c.sent, of: c.targeted, color: "#8C8984" },
        { label: "Delivered", value: c.delivered, of: c.targeted, color: "#93C5FD" },
        { label: "Opened", value: c.opened, of: c.targeted, color: "var(--accent)" },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="h-8 px-3 rounded-full text-[12.5px] font-semibold"
            style={filter === f.key ? { background: "var(--text-primary)", color: "var(--bg-primary)" } : { border: "1px solid var(--border-hover)", color: "var(--text-secondary)" }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 items-start">
        <div className="flex-[999_1_520px] min-w-0 overflow-x-auto rounded-2xl" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <table className="w-full min-w-[680px] text-[13px]">
            <thead>
              <tr className="text-left" style={{ color: "var(--text-muted)" }}>
                <th className="px-4 py-3 font-semibold">Notification</th>
                <th className="px-2 py-3 font-semibold">Audience</th>
                <th className="px-2 py-3 font-semibold text-right">Sent</th>
                <th className="px-2 py-3 font-semibold text-right">Delivered</th>
                <th className="px-4 py-3 font-semibold text-right">Opened</th>
              </tr>
            </thead>
            <tbody>
              {rows?.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => onSelect(r.id === selectedId ? null : r.id)}
                  className="cursor-pointer hover:bg-white/[0.03]"
                  style={{ borderTop: "1px solid var(--border)", background: r.id === selectedId ? "rgba(129,238,78,0.05)" : undefined }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Badge status={r.status} />
                      <span className="font-bold truncate max-w-[320px]" style={{ color: "var(--text-primary)" }}>{r.title}</span>
                    </div>
                    <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                      {r.kind === "auto" ? "Automatic · " : ""}{TYPE_LABEL[r.type] ?? r.type} · {r.status === "scheduled" || r.status === "held" ? `goes out ${when(r.scheduledFor)}` : when(r.createdAt)}
                    </div>
                  </td>
                  <td className="px-2 py-3" style={{ color: "var(--text-secondary)" }}>{audienceLabel(r)}</td>
                  <td className="px-2 py-3 text-right tabular-nums" style={{ color: "var(--text-primary)" }}>{r.status === "scheduled" || r.status === "held" ? "—" : `${r.sent}/${r.targeted}`}</td>
                  <td className="px-2 py-3 text-right tabular-nums" style={{ color: "var(--text-primary)" }}>{r.sent ? r.delivered : "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold" style={{ color: "var(--text-primary)" }}>{r.sent ? `${r.opened} · ${pct(r.opened, r.sent)}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows?.length === 0 && <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>Nothing here yet.</p>}
          {!rows && <div className="p-4 flex flex-col gap-2">{[0, 1, 2].map((i) => <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: "var(--bg-elevated)" }} />)}</div>}
          {hasMore && (
            <button onClick={() => void more()} className="w-full py-3 text-sm font-semibold hover:bg-white/5" style={{ borderTop: "1px solid var(--border)", color: "var(--accent)" }}>Show older</button>
          )}
        </div>

        {c && (
          <aside className="flex-[1_1_320px] max-w-[400px] rounded-2xl p-5 flex flex-col gap-4" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
            <div className="flex gap-3">
              {c.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.imageUrl} alt="" className="w-12 h-16 rounded-lg object-cover" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2"><Badge status={c.status} /></div>
                <p className="mt-1 font-extrabold" style={{ color: "var(--text-primary)" }}>{c.title}</p>
                {c.body && <p className="text-[12.5px] mt-0.5" style={{ color: "var(--text-secondary)" }}>{c.body}</p>}
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{c.kind === "auto" ? "Automatic" : c.kind === "test" ? "Test" : "Sent by an admin"} · {audienceLabel(c)} · {when(c.status === "scheduled" || c.status === "held" ? c.scheduledFor : c.createdAt)}</p>
              </div>
            </div>

            {c.status === "scheduled" || c.status === "held" ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {c.status === "held" ? "Waiting for quiet hours to end" : "Scheduled"} — goes out {when(c.scheduledFor)}.
                </p>
                <button onClick={() => setConfirmCancel(true)} className="h-10 rounded-xl text-sm font-bold hover:bg-white/5" style={{ border: "1px solid rgba(239,68,68,0.4)", color: "#ef4444" }}>Cancel it</button>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-2.5">
                  {funnel.map((f) => (
                    <div key={f.label} className="flex flex-col gap-1">
                      <div className="flex justify-between text-[13px]">
                        <span style={{ color: "var(--text-secondary)" }}>{f.label}</span>
                        <span className="font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{f.value}{f.label !== "Targeted" ? ` · ${pct(f.value, f.of)}` : ""}</span>
                      </div>
                      <div className="h-2 rounded" style={{ background: "rgba(255,255,255,0.07)" }}>
                        <div className="h-full rounded" style={{ width: f.of ? `${Math.max(2, (f.value / f.of) * 100)}%` : "0%", background: f.color }} />
                      </div>
                    </div>
                  ))}
                  {(c.failed > 0 || c.capped > 0) && (
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {c.failed > 0 ? `${c.failed} failed` : ""}{c.failed > 0 && c.capped > 0 ? " · " : ""}{c.capped > 0 ? `${c.capped} over the daily cap (inbox only)` : ""}
                    </p>
                  )}
                  {c.sent > 0 && c.delivered === 0 && c.status === "sent" && (
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>Delivery is confirmed about 15 minutes after sending.</p>
                  )}
                </div>
                {detail!.taps.length > 0 && (
                  <div className="rounded-xl p-3 flex flex-col gap-1.5 text-[12.5px]" style={{ background: "var(--bg-primary)" }}>
                    <span className="font-bold" style={{ color: "var(--text-primary)" }}>What people tapped</span>
                    {detail!.taps.map((t) => (
                      <span key={t.action ?? "tap"} className="flex justify-between" style={{ color: "var(--text-secondary)" }}>
                        {t.action === "tap" || !t.action ? "The notification" : (c.actions.find((a) => a.id === t.action)?.label ?? t.action)}
                        <b style={{ color: "var(--text-primary)" }}>{t.n}</b>
                      </span>
                    ))}
                  </div>
                )}
                {detail!.failures.length > 0 && (
                  <details className="rounded-xl p-3 text-[12.5px]" style={{ background: "var(--bg-primary)" }}>
                    <summary className="cursor-pointer font-bold" style={{ color: "var(--text-primary)" }}>Failed ({c.failed})</summary>
                    <ul className="mt-2 flex flex-col gap-1">
                      {detail!.failures.map((f, i) => (
                        <li key={i} style={{ color: "var(--text-secondary)" }}>
                          {f.username ? `@${f.username} · ` : ""}{f.channel === "web" ? "Browser" : (f.deviceName ?? "Phone")} — {f.error ?? "failed"}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </>
            )}
          </aside>
        )}
      </div>

      {confirmCancel && c && (
        <ConfirmDialog title="Cancel this notification?" body={<>“{c.title}” won&apos;t be sent.</>} confirmLabel="Cancel it" danger busy={busy} onCancel={() => setConfirmCancel(false)} onConfirm={doCancel} />
      )}
    </div>
  );
}
