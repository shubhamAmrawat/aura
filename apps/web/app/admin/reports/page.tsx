"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AvatarImage from "@/app/components/AvatarImage";
import { Modal, StatusBadge } from "../_components/ui";
import { useToast } from "@/lib/toast";
import {
  getReportCounts,
  getReports,
  REPORTS_CHANGED,
  resolveReport,
  type AdminReport,
  type ReportAction,
  type ReportCounts,
  type ReportReason,
  type ReportStatus,
} from "@/lib/adminApi";
import { BanIcon, CheckIcon, ExternalLinkIcon, FlagIcon, ImageOffIcon, Trash2Icon, XIcon } from "lucide-react";

const TABS: { id: ReportStatus; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "actioned", label: "Actioned" },
  { id: "dismissed", label: "Dismissed" },
];

const REASON_LABEL: Record<ReportReason, string> = {
  nudity: "Nudity / sexual",
  violence: "Violence / gore",
  hate: "Hate",
  harassment: "Harassment",
  copyright: "Copyright",
  spam: "Spam / misleading",
  impersonation: "Impersonation",
  other: "Other",
};
const SERIOUS: ReportReason[] = ["nudity", "violence", "hate", "harassment"];

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
const sourceLabel = (s: string) => (s === "mobile" ? "app" : s === "web" ? "website" : "unknown client");

type Pending = { report: AdminReport; kind: "dismiss" | "resolve" | "delete_wallpaper" | "disable_user" };

const DIALOG: Record<Pending["kind"], { title: (r: AdminReport) => string; body: (r: AdminReport) => string; confirm: string; danger: boolean; noteLabel: string }> = {
  dismiss: {
    title: () => "Dismiss this report?",
    body: (r) => `Nothing changes on Aurora. ${r.openOnTarget > 1 ? `All ${r.openOnTarget} open reports on this ${r.targetType} are closed.` : "The report is closed."}`,
    confirm: "Dismiss",
    danger: false,
    noteLabel: "Note for the log (optional)",
  },
  resolve: {
    title: () => "Mark as handled?",
    body: () => "Use this when you already fixed it elsewhere (edited the wallpaper, talked to the creator). The report is closed as actioned.",
    confirm: "Mark handled",
    danger: false,
    noteLabel: "What did you do? (optional)",
  },
  delete_wallpaper: {
    title: (r) => `Delete “${r.wallpaper?.title ?? r.targetLabel}”?`,
    body: (r) => `The wallpaper and its file are deleted for good. ${r.openOnTarget > 1 ? `All ${r.openOnTarget} open reports on it are closed.` : ""}`,
    confirm: "Delete wallpaper",
    danger: true,
    noteLabel: "Note for the log (optional)",
  },
  disable_user: {
    title: (r) => `Disable @${r.reportedUser?.username}?`,
    body: () => "They can't sign in and all their live wallpapers are hidden. You can enable the account again from Users. Their open reports are closed.",
    confirm: "Disable account",
    danger: true,
    noteLabel: "Reason (saved on the account)",
  },
};

function Page() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { toast } = useToast();
  const tab = (TABS.find((t) => t.id === params.get("status"))?.id ?? "open") as ReportStatus;

  const [items, setItems] = useState<AdminReport[] | null>(null);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<ReportCounts | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, c] = await Promise.all([getReports(tab), getReportCounts()]);
      setItems(list.data);
      setTotal(list.total);
      setCounts(c);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn’t load reports", "error");
      setItems([]);
    }
  }, [tab, toast]);

  useEffect(() => {
    setItems(null);
    void load();
  }, [load]);

  const loadMore = async () => {
    if (!items || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await getReports(tab, items.length);
      setItems((cur) => [...(cur ?? []), ...res.data.filter((r) => !cur?.some((c) => c.id === r.id))]);
      setTotal(res.total);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn’t load more", "error");
    } finally {
      setLoadingMore(false);
    }
  };

  const open = (report: AdminReport, kind: Pending["kind"]) => {
    setNote(kind === "disable_user" ? `Reported for ${REASON_LABEL[report.reason].toLowerCase()}` : "");
    setPending({ report, kind });
  };

  async function confirm() {
    if (!pending) return;
    const { report, kind } = pending;
    const action: ReportAction = kind === "delete_wallpaper" || kind === "disable_user" ? kind : "none";
    setBusy(true);
    try {
      const res = await resolveReport(report.id, { status: kind === "dismiss" ? "dismissed" : "actioned", action, note: note.trim() || null });
      const closed = new Set(res.closedIds);
      setItems((cur) => cur?.filter((r) => !closed.has(r.id)) ?? cur);
      setTotal((t) => Math.max(0, t - closed.size));
      setCounts((c) => (c ? { ...c, open: Math.max(0, c.open - closed.size), [kind === "dismiss" ? "dismissed" : "actioned"]: c[kind === "dismiss" ? "dismissed" : "actioned"] + closed.size } : c));
      window.dispatchEvent(new Event(REPORTS_CHANGED));
      toast(
        kind === "delete_wallpaper" ? "Wallpaper deleted" : kind === "disable_user" ? "Account disabled" : kind === "dismiss" ? "Report dismissed" : "Marked as handled",
        "success"
      );
      setPending(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong", "error");
    } finally {
      setBusy(false);
    }
  }

  const setTab = (id: ReportStatus) => {
    const sp = new URLSearchParams(params.toString());
    sp.set("status", id);
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  };

  const d = pending ? DIALOG[pending.kind] : null;

  return (
    <div className="pb-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Reports</h1>
          <p className="text-sm mt-1 max-w-xl" style={{ color: "var(--text-secondary)" }}>
            {tab === "open"
              ? "Wallpapers and creators people reported from the app or website, newest first. Google Play expects these to be reviewed and acted on."
              : tab === "actioned"
                ? "Reports where something was done: a wallpaper deleted, an account disabled, or fixed by hand."
                : "Reports closed without a change."}
          </p>
        </div>
        <div className="flex rounded-lg p-1 gap-1" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="px-3 py-1.5 rounded-md text-sm transition-colors"
              style={{ background: tab === t.id ? "var(--accent)" : "transparent", color: tab === t.id ? "var(--bg-primary)" : "var(--text-secondary)", fontWeight: tab === t.id ? 600 : 400 }}
            >
              {t.label}
              {counts && <span className="ml-1.5 tabular-nums opacity-80">{counts[t.id]}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3" role="list" aria-label="Reports">
        {items === null ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[132px] rounded-xl animate-pulse" style={{ background: "var(--bg-secondary)" }} />)
        ) : items.length === 0 ? (
          <div className="rounded-xl px-4 py-14 text-center" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
            <FlagIcon size={22} strokeWidth={1.8} className="mx-auto" style={{ color: "var(--text-muted)" }} aria-hidden="true" />
            <p className="text-sm font-medium mt-3" style={{ color: "var(--text-primary)" }}>{tab === "open" ? "No open reports" : "Nothing here yet"}</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{tab === "open" ? "New reports will show up here." : "Closed reports appear here."}</p>
          </div>
        ) : (
          items.map((r) => <ReportCard key={r.id} r={r} onAction={(kind) => open(r, kind)} />)
        )}
        {items && items.length < total && (
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="self-center h-10 px-4 rounded-lg text-sm border disabled:opacity-50"
            style={{ borderColor: "var(--border-hover)", color: "var(--text-primary)" }}
          >
            {loadingMore ? "Loading…" : `Show more (${total - items.length})`}
          </button>
        )}
      </div>

      {pending && d && (
        <Modal onClose={() => setPending(null)} busy={busy} width={440} labelledBy="report-dialog-title">
          <div>
            <p id="report-dialog-title" className="font-semibold" style={{ color: "var(--text-primary)" }}>{d.title(pending.report)}</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{d.body(pending.report)}</p>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{d.noteLabel}</span>
            <textarea
              rows={3}
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-y focus:border-[color:var(--accent)]"
              style={{ background: "var(--bg-primary)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-primary)" }}
            />
          </label>
          <div className="flex justify-end gap-2">
            <button autoFocus disabled={busy} onClick={() => setPending(null)} className="text-sm px-3 py-2 rounded-lg hover:bg-white/5 disabled:opacity-40" style={{ color: "var(--text-secondary)" }}>
              Cancel
            </button>
            <button
              disabled={busy || (pending.kind === "disable_user" && note.trim().length < 3)}
              onClick={() => void confirm()}
              className="text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
              style={d.danger ? { background: "#ef4444", color: "#fff" } : { background: "var(--accent)", color: "var(--bg-primary)" }}
            >
              {busy ? "Working…" : d.confirm}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ReportCard({ r, onAction }: { r: AdminReport; onAction: (kind: Pending["kind"]) => void }) {
  const isOpen = r.status === "open";
  const serious = SERIOUS.includes(r.reason);
  const user = r.reportedUser;
  const fallbackAvatar = (
    <div className="w-full h-full rounded-full flex items-center justify-center font-semibold text-xl" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>
      {(user?.displayName || user?.username || "?")[0]?.toUpperCase()}
    </div>
  );

  return (
    <article role="listitem" className="rounded-xl p-4 flex gap-4" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
      {/* what was reported */}
      <div className="w-[72px] shrink-0">
        {r.targetType === "wallpaper" ? (
          r.wallpaper ? (
            <a href={r.wallpaper.fileUrl} target="_blank" rel="noopener noreferrer" className="block w-[72px] h-[96px] rounded-lg overflow-hidden" style={{ background: "var(--bg-elevated)" }} aria-label="Open the original image">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.wallpaper.thumbUrl ?? r.wallpaper.fileUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
            </a>
          ) : (
            <div className="w-[72px] h-[96px] rounded-lg flex flex-col items-center justify-center gap-1 text-[10px]" style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}>
              <ImageOffIcon size={18} strokeWidth={1.8} aria-hidden="true" />
              Deleted
            </div>
          )
        ) : (
          <div className="w-[72px] h-[72px] rounded-full overflow-hidden">
            {user ? <AvatarImage src={user.avatarUrl} alt={user.displayName} className="w-full h-full object-cover" fallback={fallbackAvatar} /> : fallbackAvatar}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: "var(--text-muted)" }}>{r.targetType === "wallpaper" ? "Wallpaper" : "Creator"}</span>
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={serious ? { background: "rgba(239,68,68,0.14)", color: "#f87171" } : { background: "rgba(250,204,21,0.12)", color: "#facc15" }}
          >
            {REASON_LABEL[r.reason] ?? r.reason}
          </span>
          {isOpen && r.openOnTarget > 1 && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.14)", color: "#f87171" }}>
              {r.openOnTarget} open reports
            </span>
          )}
          {r.wallpaper && <StatusBadge status={r.wallpaper.status} />}
          {user?.disabledAt && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(148,163,184,0.14)", color: "#94a3b8" }}>Account disabled</span>}
        </div>

        <div className="min-w-0">
          <p className="text-[15px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
            {r.targetType === "wallpaper" ? r.wallpaper?.title ?? r.targetLabel ?? "Deleted wallpaper" : user ? user.displayName : r.targetLabel ?? "Deleted account"}
          </p>
          <p className="text-[13px] mt-0.5 flex flex-wrap items-center gap-x-2" style={{ color: "var(--text-muted)" }}>
            {user ? (
              <Link href={`/admin/users?q=${encodeURIComponent(user.username)}`} className="underline underline-offset-2 hover:text-[color:var(--text-primary)]">
                @{user.username}
              </Link>
            ) : r.targetType === "wallpaper" ? (
              <span>Admin upload</span>
            ) : null}
            {r.wallpaper?.status === "approved" && (
              <a href={`/wallpaper/${r.wallpaper.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-[color:var(--text-primary)]">
                View on site
                <ExternalLinkIcon size={11} strokeWidth={2} aria-hidden="true" />
              </a>
            )}
          </p>
        </div>

        {r.details && (
          <p className="text-sm leading-relaxed whitespace-pre-line rounded-lg px-3 py-2" style={{ background: "var(--bg-elevated)", color: "#d4d4d4" }}>
            “{r.details}”
          </p>
        )}

        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Reported {timeAgo(r.createdAt)} by {r.reporter ? `@${r.reporter.username}` : "a guest"} from the {sourceLabel(r.source)}
          {!isOpen && r.resolvedAt ? ` · closed ${timeAgo(r.resolvedAt)}` : ""}
        </p>
        {!isOpen && r.resolutionNote && <p className="text-xs" style={{ color: "#b5b5b5" }}>Note: {r.resolutionNote}</p>}

        {isOpen && (
          <div className="flex flex-wrap gap-2 pt-1">
            {r.wallpaper && (
              <button type="button" onClick={() => onAction("delete_wallpaper")} className="h-9 px-3 rounded-lg text-[13px] font-semibold inline-flex items-center gap-1.5" style={{ background: "#ef4444", color: "#fff" }}>
                <Trash2Icon size={14} strokeWidth={2.2} aria-hidden="true" />
                Delete wallpaper
              </button>
            )}
            {user && !user.disabledAt && (
              <button type="button" onClick={() => onAction("disable_user")} className="h-9 px-3 rounded-lg text-[13px] font-semibold inline-flex items-center gap-1.5 border" style={{ borderColor: "rgba(239,68,68,0.5)", color: "#f87171" }}>
                <BanIcon size={14} strokeWidth={2.2} aria-hidden="true" />
                Disable @{user.username}
              </button>
            )}
            <button type="button" onClick={() => onAction("resolve")} className="h-9 px-3 rounded-lg text-[13px] font-medium inline-flex items-center gap-1.5 border" style={{ borderColor: "var(--border-hover)", color: "var(--text-primary)" }}>
              <CheckIcon size={14} strokeWidth={2.2} aria-hidden="true" />
              Mark handled
            </button>
            <button type="button" onClick={() => onAction("dismiss")} className="h-9 px-3 rounded-lg text-[13px] font-medium inline-flex items-center gap-1.5 hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>
              <XIcon size={14} strokeWidth={2.2} aria-hidden="true" />
              Dismiss
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  );
}
