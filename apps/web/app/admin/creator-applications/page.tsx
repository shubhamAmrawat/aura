"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AvatarImage from "@/app/components/AvatarImage";
import { ConfirmDialog } from "../_components/ui";
import { useToast } from "@/lib/toast";
import {
  approveCreatorApplication,
  CREATOR_APPS_CHANGED,
  getCreatorApplication,
  getCreatorApplications,
  rejectCreatorApplication,
  rescoreCreatorApplication,
  type CreatorAppCounts,
  type CreatorAppDetail,
  type CreatorAppListItem,
  type CreatorAppStatus,
} from "@/lib/adminApi";
import { ArrowLeftIcon, ArrowUpRightIcon, CheckIcon, SparkleIcon, XIcon } from "lucide-react";

const TABS: { id: CreatorAppStatus; label: string }[] = [
  { id: "pending", label: "Waiting" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

const REASONS = [
  "Low resolution or looks upscaled",
  "Watermark too large — it covers the image",
  "Doesn’t look like your original work",
  "Needs a more consistent style",
  "Not made for screens (crop or composition)",
];

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const fmtSize = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;

/** Used when the AI has no draft (still scoring, or it failed). */
const FALLBACK = {
  approve: "Your work stood out to our team — sharp, considered and made for screens. We can’t wait to see what you publish.",
  reject: "Thanks for sharing your work. This time the set wasn’t quite ready for Aurora — send sharper originals in a consistent style and apply again.",
};
type Decision = "approve" | "reject";
const aiDraft = (d: CreatorAppDetail, k: Decision) => (k === "approve" ? d.aiApproveMessage : d.aiRejectMessage) || FALLBACK[k];

/** Green / amber / red for a 0–100 score. */
function tone(score: number | null) {
  if (score === null) return { color: "var(--text-muted)", bg: "rgba(255,255,255,0.06)" };
  if (score >= 75) return { color: "var(--accent)", bg: "rgba(129,238,78,0.12)" };
  if (score >= 55) return { color: "#facc15", bg: "rgba(250,204,21,0.12)" };
  return { color: "#f87171", bg: "rgba(248,113,113,0.12)" };
}

function Avatar({ name, src, size }: { name: string; src: string | null; size: number }) {
  const fallback = (
    <div className="rounded-full flex items-center justify-center font-semibold shrink-0" style={{ width: size, height: size, background: "var(--accent)", color: "var(--bg-primary)", fontSize: size * 0.4 }}>
      {name?.[0]?.toUpperCase()}
    </div>
  );
  return <AvatarImage src={src} alt={name} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} fallback={fallback} />;
}

function Page() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { toast } = useToast();

  const tab = (TABS.find((t) => t.id === params.get("status"))?.id ?? "pending") as CreatorAppStatus;
  const selectedId = params.get("id");

  const [items, setItems] = useState<CreatorAppListItem[] | null>(null);
  const [counts, setCounts] = useState<CreatorAppCounts | null>(null);
  const [detail, setDetail] = useState<CreatorAppDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  // The email note for each decision: starts as the AI's draft, the admin can edit it.
  const [decision, setDecision] = useState<Decision>("approve");
  const [drafts, setDrafts] = useState<Record<Decision, string>>({ approve: "", reject: "" });
  const [edited, setEdited] = useState<Record<Decision, boolean>>({ approve: false, reject: false });
  const [busy, setBusy] = useState<"approve" | "reject" | "rescore" | null>(null);
  const [confirm, setConfirm] = useState<Decision | null>(null);
  const note = drafts[decision];

  /** Fill the drafts from the AI (keeping anything the admin already edited). */
  const applyDrafts = useCallback((d: CreatorAppDetail, keepEdits: boolean) => {
    setDrafts((cur) => ({
      approve: keepEdits && edited.approve ? cur.approve : aiDraft(d, "approve"),
      reject: keepEdits && edited.reject ? cur.reject : aiDraft(d, "reject"),
    }));
    if (!keepEdits) {
      setEdited({ approve: false, reject: false });
      // Start on what the AI leans towards; borderline and unscored ones start on approve.
      setDecision(d.aiStatus === "done" && (d.aiScore ?? 0) < 55 ? "reject" : "approve");
    }
  }, [edited.approve, edited.reject]);

  const setQuery = useCallback(
    (q: { status?: CreatorAppStatus; id?: string | null }) => {
      const sp = new URLSearchParams(params.toString());
      if (q.status) sp.set("status", q.status);
      if (q.id === null) sp.delete("id");
      else if (q.id) sp.set("id", q.id);
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    },
    [params, pathname, router]
  );

  const loadList = useCallback(async () => {
    try {
      const res = await getCreatorApplications(tab);
      setItems(res.data);
      setCounts(res.counts);
      return res.data;
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn’t load applications", "error");
      setItems([]);
      return [];
    }
  }, [tab, toast]);

  useEffect(() => {
    setItems(null);
    void loadList();
  }, [loadList]);

  // Select the first one when nothing (valid) is selected — on wide screens only, phones see the list first.
  const current = useMemo(() => items?.find((i) => i.id === selectedId) ?? null, [items, selectedId]);
  useEffect(() => {
    if (items && items.length && !current && window.matchMedia("(min-width: 1024px)").matches) setQuery({ id: items[0]!.id });
  }, [items, current, setQuery]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    let alive = true;
    setDetailLoading(true);
    getCreatorApplication(selectedId)
      .then((d) => {
        if (!alive) return;
        setDetail(d);
        applyDrafts(d, false);
      })
      .catch((e: unknown) => alive && toast(e instanceof Error ? e.message : "Couldn’t load the application", "error"))
      .finally(() => alive && setDetailLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the selection changes
  }, [selectedId, toast]);

  // While the AI is still scoring, check again every few seconds.
  useEffect(() => {
    if (detail?.aiStatus !== "pending") return;
    const t = setInterval(() => {
      getCreatorApplication(detail.id).then((d) => {
        if (d.aiStatus !== "pending") {
          setDetail(d);
          applyDrafts(d, true);
          setItems((cur) => cur?.map((i) => (i.id === d.id ? { ...i, aiStatus: d.aiStatus, aiScore: d.aiScore, aiVerdict: d.aiVerdict } : i)) ?? cur);
        }
      }).catch(() => undefined);
    }, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- poll only while scoring
  }, [detail?.aiStatus, detail?.id]);

  async function decide(kind: "approve" | "reject") {
    if (!detail) return;
    setBusy(kind);
    try {
      if (kind === "approve") await approveCreatorApplication(detail.id, note.trim());
      else await rejectCreatorApplication(detail.id, note.trim());
      toast(kind === "approve" ? `${detail.user.displayName} is now a creator` : "Application rejected — they’ve been emailed", "success");
      setConfirm(null);
      const idx = items?.findIndex((i) => i.id === detail.id) ?? -1;
      const fresh = await loadList();
      window.dispatchEvent(new Event(CREATOR_APPS_CHANGED));
      const next = fresh[Math.min(Math.max(idx, 0), fresh.length - 1)];
      setQuery({ id: next ? next.id : null });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong", "error");
    } finally {
      setBusy(null);
    }
  }

  async function rescore() {
    if (!detail) return;
    setBusy("rescore");
    try {
      const d = await rescoreCreatorApplication(detail.id);
      setDetail(d);
      applyDrafts(d, true);
      setItems((cur) => cur?.map((i) => (i.id === d.id ? { ...i, aiStatus: d.aiStatus, aiScore: d.aiScore, aiVerdict: d.aiVerdict } : i)) ?? cur);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn’t score it", "error");
    } finally {
      setBusy(null);
    }
  }

  const editNote = (text: string) => {
    setDrafts((cur) => ({ ...cur, [decision]: text }));
    setEdited((cur) => ({ ...cur, [decision]: true }));
  };
  const addReason = (r: string) => editNote(note.includes(r) ? note : note.trim() ? `${note.trim()}\n${r}.` : `${r}.`);
  const resetDraft = () => {
    if (!detail) return;
    setDrafts((cur) => ({ ...cur, [decision]: aiDraft(detail, decision) }));
    setEdited((cur) => ({ ...cur, [decision]: false }));
  };
  const canSend = decision === "approve" || note.trim().length >= 3;
  const fromAi = !!detail && (decision === "approve" ? detail.aiApproveMessage : detail.aiRejectMessage) && !edited[decision];

  return (
    <div className="pb-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Creator applications</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {tab === "pending" ? "People asking to publish on Aurora. Oldest first — the AI score is a hint, the decision is yours." : tab === "approved" ? "Approved applications, newest first." : "Rejected applications, newest first."}
          </p>
        </div>
        <div className="flex rounded-lg p-1 gap-1" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setQuery({ status: t.id, id: null })}
              className="px-3 py-1.5 rounded-md text-sm transition-colors"
              style={{ background: tab === t.id ? "var(--accent)" : "transparent", color: tab === t.id ? "var(--bg-primary)" : "var(--text-secondary)", fontWeight: tab === t.id ? 600 : 400 }}
            >
              {t.label}
              {counts && <span className="ml-1.5 tabular-nums opacity-80">{counts[t.id]}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-col lg:flex-row gap-5 items-start">
        {/* ── list ── */}
        <div
          className={`w-full lg:w-[330px] shrink-0 rounded-xl p-2 flex flex-col gap-1 ${selectedId ? "hidden lg:flex" : "flex"}`}
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
          role="list"
          aria-label="Applications"
        >
          {items === null ? (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[58px] rounded-lg animate-pulse" style={{ background: "var(--bg-elevated)" }} />)
          ) : items.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{tab === "pending" ? "All caught up" : "Nothing here yet"}</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{tab === "pending" ? "New applications will show up here." : "Decided applications appear here."}</p>
            </div>
          ) : (
            items.map((a) => {
              const active = a.id === selectedId;
              const t = tone(a.aiScore);
              return (
                <button
                  key={a.id}
                  role="listitem"
                  onClick={() => setQuery({ id: a.id })}
                  aria-current={active ? "true" : undefined}
                  className="w-full text-left rounded-lg px-3 py-2.5 flex items-center gap-3 transition-colors hover:bg-white/[0.04]"
                  style={{ background: active ? "var(--bg-elevated)" : undefined, border: `1px solid ${active ? "var(--border-hover)" : "transparent"}` }}
                >
                  <Avatar name={a.displayName} src={a.avatarUrl} size={36} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{a.displayName}</span>
                    <span className="block text-xs truncate" style={{ color: "var(--text-muted)" }}>
                      {timeAgo(tab === "pending" ? a.createdAt : a.reviewedAt ?? a.createdAt)} · {a.sampleCount} samples
                    </span>
                  </span>
                  <span className="h-6 min-w-9 px-1.5 rounded-md text-xs font-bold flex items-center justify-center tabular-nums" style={{ background: t.bg, color: t.color }} title={a.aiVerdict ?? undefined}>
                    {a.aiStatus === "pending" ? "…" : a.aiScore ?? "–"}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* ── detail ── */}
        <section className={`flex-1 min-w-0 w-full rounded-xl p-5 sm:p-6 flex-col gap-6 ${selectedId ? "flex" : "hidden lg:flex"}`} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          {!selectedId || (!detail && !detailLoading) ? (
            <p className="text-sm py-16 text-center" style={{ color: "var(--text-muted)" }}>{items?.length ? "Pick an application to review it." : "No application selected."}</p>
          ) : !detail || detail.id !== selectedId ? (
            <div className="flex flex-col gap-4" aria-busy="true">
              <div className="h-12 w-64 rounded-lg animate-pulse" style={{ background: "var(--bg-elevated)" }} />
              <div className="h-20 rounded-lg animate-pulse" style={{ background: "var(--bg-elevated)" }} />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-[9/16] rounded-lg animate-pulse" style={{ background: "var(--bg-elevated)" }} />)}</div>
            </div>
          ) : (
            <>
              <button type="button" onClick={() => setQuery({ id: null })} className="lg:hidden self-start text-sm inline-flex items-center gap-1.5 min-h-10" style={{ color: "var(--text-secondary)" }}>
                <ArrowLeftIcon size={14} strokeWidth={2} aria-hidden="true" />
                All applications
              </button>

              <div className="flex flex-wrap items-center gap-3.5">
                <Avatar name={detail.user.displayName} src={detail.user.avatarUrl} size={48} />
                <div className="flex-1 min-w-[200px]">
                  <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{detail.user.displayName}</p>
                  <p className="text-[13px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                    @{detail.user.username} · {detail.user.email} · joined {fmtDate(detail.user.createdAt)}
                  </p>
                </div>
                {detail.portfolioUrl && (
                  <a href={detail.portfolioUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-[13px] underline underline-offset-4 inline-flex items-center gap-1" style={{ color: "#cfcfcf" }}>
                    Portfolio
                    <ArrowUpRightIcon size={12} strokeWidth={2} aria-hidden="true" />
                  </a>
                )}
              </div>

              {/* AI pre-screen */}
              <div className="rounded-lg px-4 sm:px-5 py-4 flex flex-wrap gap-5 items-center" style={{ background: "var(--bg-elevated)" }}>
                {detail.aiStatus === "pending" ? (
                  <div className="flex items-center gap-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                    <span className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: "var(--border-hover)", borderTopColor: "var(--accent)" }} />
                    The AI is scoring these samples…
                  </div>
                ) : detail.aiStatus === "failed" ? (
                  <div className="flex flex-wrap items-center gap-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                    The AI couldn’t score this application.
                    <button type="button" onClick={() => void rescore()} disabled={busy === "rescore"} className="h-8 px-3 rounded-md text-xs font-medium border disabled:opacity-50" style={{ borderColor: "var(--border-hover)", color: "var(--text-primary)" }}>
                      {busy === "rescore" ? "Scoring…" : "Score again"}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold tabular-nums" style={{ color: tone(detail.aiScore).color }}>{detail.aiScore}</span>
                      <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>/ 100</span>
                    </div>
                    <div className="flex-1 min-w-[240px] flex flex-col gap-1">
                      <span className="text-[11px] tracking-[0.12em] uppercase" style={{ color: "var(--text-muted)" }}>AI pre-screen · {detail.aiVerdict}</span>
                      <p className="text-sm leading-relaxed" style={{ color: "#d4d4d4" }}>{detail.aiSummary}</p>
                    </div>
                  </>
                )}
              </div>

              {/* samples */}
              <div className="flex flex-col gap-2.5">
                <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Samples <span className="font-normal" style={{ color: "var(--text-muted)" }}>· click to open the original</span></h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {detail.samples.map((s, i) => {
                    const t = tone(s.aiScore);
                    return (
                      <figure key={s.id} className="m-0 flex flex-col gap-1.5">
                        <a href={s.fileUrl} target="_blank" rel="noopener noreferrer" className="group relative aspect-[9/16] rounded-lg overflow-hidden block" style={{ background: "var(--bg-elevated)" }} aria-label={`Open sample ${i + 1} full size`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={s.thumbUrl} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                          {s.aiScore !== null && (
                            <span className="absolute top-2 left-2 h-[22px] px-1.5 rounded-md text-xs font-bold flex items-center tabular-nums" style={{ background: "rgba(10,10,10,0.78)", color: t.color }}>{s.aiScore}</span>
                          )}
                          <span className="absolute right-2 bottom-2 h-[22px] px-1.5 rounded-md text-[11px] flex items-center tabular-nums" style={{ background: "rgba(10,10,10,0.78)", color: "#cfcfcf" }}>
                            {s.width} × {s.height} · {fmtSize(s.bytes)}
                          </span>
                        </a>
                        {s.aiNote && <figcaption className="text-xs leading-snug" style={{ color: s.aiScore !== null && s.aiScore < 75 ? t.color : "var(--text-muted)" }}>{s.aiNote}</figcaption>}
                      </figure>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>About their work</h2>
                <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: detail.about ? "#b5b5b5" : "var(--text-muted)" }}>{detail.about || "They didn’t add anything."}</p>
              </div>

              {detail.status === "pending" ? (
                <div className="pt-5 flex flex-col gap-3" style={{ borderTop: "1px solid var(--border)" }}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Email to {detail.user.displayName.split(" ")[0]}</h2>
                      {fromAi ? (
                        <span className="h-5 px-1.5 rounded text-[10px] font-semibold uppercase tracking-wider inline-flex items-center gap-1" style={{ background: "rgba(139,124,246,0.14)", color: "#b4a9ff" }}>
                          <SparkleIcon size={10} strokeWidth={1} fill="currentColor" aria-hidden="true" />
                          AI draft
                        </span>
                      ) : edited[decision] ? (
                        <button type="button" onClick={resetDraft} className="text-xs underline underline-offset-2" style={{ color: "var(--text-muted)" }}>
                          {detail.aiStatus === "done" ? "Reset to AI draft" : "Reset"}
                        </button>
                      ) : null}
                    </div>
                    <div className="flex rounded-lg p-1 gap-1" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }} role="tablist" aria-label="Decision">
                      {(["approve", "reject"] as const).map((k) => (
                        <button
                          key={k}
                          type="button"
                          role="tab"
                          aria-selected={decision === k}
                          onClick={() => setDecision(k)}
                          className="px-3 py-1 rounded-md text-[13px] transition-colors"
                          style={
                            decision === k
                              ? k === "approve"
                                ? { background: "var(--accent)", color: "var(--bg-primary)", fontWeight: 600 }
                                : { background: "#ef4444", color: "#fff", fontWeight: 600 }
                              : { color: "var(--text-secondary)" }
                          }
                        >
                          {k === "approve" ? "Approve" : "Reject"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {decision === "reject" && (
                    <div className="flex flex-wrap gap-1.5">
                      {REASONS.map((r) => (
                        <button key={r} type="button" onClick={() => addReason(r)} className="h-8 px-3 rounded-lg text-[13px] transition-colors hover:bg-white/[0.05]" style={{ border: `1px solid ${note.includes(r) ? "var(--accent)" : "var(--border-hover)"}`, color: "#d4d4d4" }}>
                          + {r}
                        </button>
                      ))}
                    </div>
                  )}
                  <textarea
                    id="cap-note"
                    aria-label={`Note sent with the ${decision === "approve" ? "approval" : "rejection"} email`}
                    rows={4}
                    value={note}
                    maxLength={500}
                    onChange={(e) => editNote(e.target.value)}
                    placeholder={decision === "reject" ? "What should they improve? They’ll see this in their email and on their profile." : "Optional — a line about what you liked."}
                    className="w-full px-3 py-2.5 rounded-lg text-sm leading-relaxed outline-none resize-y focus:border-[color:var(--accent)]"
                    style={{ background: "var(--bg-primary)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-primary)" }}
                  />
                  <div className="flex justify-between gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                    <span>
                      {decision === "approve"
                        ? "Sent inside the “You’re an Aurora creator” email."
                        : "Sent inside the rejection email, and shown on their profile."}
                    </span>
                    <span className="tabular-nums shrink-0">{note.length}/500</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <span className="flex-1 min-w-[200px] text-xs" style={{ color: detail.pausesOnReject && decision === "reject" ? "#facc15" : "var(--text-muted)" }}>
                      {detail.attempt === 1 ? "First application" : `${ordinal(detail.attempt)} application · ${detail.rejectionsBefore} earlier ${detail.rejectionsBefore === 1 ? "rejection" : "rejections"}`}
                      {detail.pausesOnReject && decision === "reject" ? " · rejecting starts a 1-day pause" : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfirm(decision)}
                      disabled={!canSend || !!busy}
                      title={canSend ? undefined : "Add a note first"}
                      className="h-10 px-4 rounded-lg text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity hover:opacity-90"
                      style={decision === "approve" ? { background: "var(--accent)", color: "var(--bg-primary)" } : { background: "#ef4444", color: "#fff" }}
                    >
                      {decision === "approve" ? (
                        <CheckIcon size={15} strokeWidth={2.6} aria-hidden="true" />
                      ) : (
                        <XIcon size={14} strokeWidth={2.6} aria-hidden="true" />
                      )}
                      {decision === "approve" ? "Approve and send" : "Reject and send"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pt-5 flex flex-col gap-2" style={{ borderTop: "1px solid var(--border)" }}>
                  <p className="text-sm" style={{ color: detail.status === "approved" ? "var(--accent)" : "#f87171" }}>
                    {detail.status === "approved" ? "Approved" : "Rejected"}
                    {detail.reviewerName ? ` by ${detail.reviewerName}` : ""}
                    {detail.reviewedAt ? ` · ${fmtDate(detail.reviewedAt)}` : ""}
                  </p>
                  {detail.reviewNote && <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "#b5b5b5" }}>{detail.reviewNote}</p>}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {confirm && detail && (
        <ConfirmDialog
          title={confirm === "approve" ? `Make ${detail.user.displayName} a creator?` : "Reject this application?"}
          body={
            confirm === "approve"
              ? "They can publish wallpapers right away, and get the approval email with your note."
              : `They’ll get an email with your note.${detail.pausesOnReject ? " This is their 3rd rejection in a row, so they can’t apply again for 24 hours." : " They can apply again right away."}`
          }
          confirmLabel={confirm === "approve" ? "Approve and send" : "Reject and send"}
          danger={confirm === "reject"}
          busy={!!busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void decide(confirm)}
        />
      )}
    </div>
  );
}

export default function CreatorApplicationsPage() {
  return (
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  );
}
