"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  approveWallpaper,
  bulkReview,
  getReviewQueue,
  rejectWallpaper,
  type ReviewItem,
  type ReviewStatus,
} from "@/lib/adminApi";
import { useToast } from "@/lib/toast";

const PAGE = 24;
const PRESET_REASONS = [
  "Low quality or blurry",
  "Inappropriate content",
  "Duplicate of an existing wallpaper",
  "Possible copyright issue",
  "Not a wallpaper",
];

const fmtSize = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

type RejectTarget = { ids: string[] } | null;

export default function ReviewQueuePage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<ReviewStatus>("pending");
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [counts, setCounts] = useState<Record<ReviewStatus, number | null>>({ pending: null, rejected: null });
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState(0);
  const [preview, setPreview] = useState<ReviewItem | null>(null);
  const [rejectTarget, setRejectTarget] = useState<RejectTarget>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const load = useCallback(async (status: ReviewStatus, offset = 0) => {
    setLoading(true);
    setError("");
    try {
      const page = await getReviewQueue(status, offset, PAGE);
      setItems((prev) => (offset === 0 ? page.data : [...prev, ...page.data]));
      setHasMore(page.hasMore);
      setCounts((c) => ({ ...c, [status]: page.total }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  // Counts for both tabs on first load
  useEffect(() => {
    void getReviewQueue(tab === "pending" ? "rejected" : "pending", 0, 1)
      .then((p) => setCounts((c) => ({ ...c, [tab === "pending" ? "rejected" : "pending"]: p.total })))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSelected(new Set());
    setFocus(0);
    void load(tab, 0);
  }, [tab, load]);

  /** Remove handled items from the list and adjust both tab counts. */
  const settle = useCallback((ids: string[], movedTo: ReviewStatus | "approved") => {
    const gone = new Set(ids);
    setItems((prev) => prev.filter((w) => !gone.has(w.id)));
    setSelected((prev) => new Set([...prev].filter((id) => !gone.has(id))));
    setCounts((c) => ({
      ...c,
      [tab]: Math.max(0, (c[tab] ?? ids.length) - ids.length),
      ...(movedTo === "rejected" && tab !== "rejected" ? { rejected: c.rejected === null ? null : c.rejected + ids.length } : {}),
    }));
    setFocus((f) => Math.max(0, Math.min(f, items.length - ids.length - 1)));
  }, [tab, items.length]);

  const markBusy = (ids: string[], on: boolean) =>
    setBusy((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });

  const doApprove = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    markBusy(ids, true);
    try {
      if (ids.length === 1) {
        await approveWallpaper(ids[0]!);
        settle(ids, "approved");
        toast(tab === "rejected" ? "Restored — it's live again." : "Approved — it's live.", "success");
      } else {
        const res = await bulkReview(ids, "approve");
        settle(res.results.filter((r) => r.ok).map((r) => r.id), "approved");
        toast(`${res.succeeded} approved${res.failed ? ` · ${res.failed} failed` : ""}`, res.failed ? "error" : "success");
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to approve", "error");
    } finally {
      markBusy(ids, false);
    }
  }, [settle, tab, toast]);

  const doReject = useCallback(async (ids: string[], reason: string) => {
    markBusy(ids, true);
    try {
      if (ids.length === 1) {
        await rejectWallpaper(ids[0]!, reason);
        settle(ids, "rejected");
        toast("Rejected — hidden, deleted in 30 days.", "success");
      } else {
        const res = await bulkReview(ids, "reject", reason);
        settle(res.results.filter((r) => r.ok).map((r) => r.id), "rejected");
        toast(`${res.succeeded} rejected${res.failed ? ` · ${res.failed} failed` : ""}`, res.failed ? "error" : "success");
      }
      setRejectTarget(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to reject", "error");
    } finally {
      markBusy(ids, false);
    }
  }, [settle, toast]);

  // Keyboard: ←/→ or J/K move, A approve/restore, R reject, Space select, Enter preview
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (rejectTarget || preview) {
        if (e.key === "Escape") { setRejectTarget(null); setPreview(null); }
        return;
      }
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") return;
      const item = items[focus];
      const k = e.key.toLowerCase();
      if (k === "arrowright" || k === "j") { e.preventDefault(); setFocus((f) => Math.min(items.length - 1, f + 1)); }
      else if (k === "arrowleft" || k === "k") { e.preventDefault(); setFocus((f) => Math.max(0, f - 1)); }
      else if (!item || busy.has(item.id)) return;
      else if (k === "a") void doApprove([item.id]);
      else if (k === "r" && tab === "pending") setRejectTarget({ ids: [item.id] });
      else if (k === " ") { e.preventDefault(); toggleSelect(item.id); }
      else if (k === "enter") setPreview(item);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    cardRefs.current[focus]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focus]);

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allSelected = items.length > 0 && items.every((w) => selected.has(w.id));
  const selectedIds = useMemo(() => [...selected], [selected]);

  return (
    <div className="pb-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Review queue</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {tab === "pending"
              ? "Uploads the automatic check wasn't sure about. Oldest first."
              : "Hidden from the site. Restore within 30 days, after that they're deleted."}
          </p>
        </div>
        <div className="flex rounded-lg p-1 gap-1" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          {(["pending", "rejected"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setTab(s)}
              className="px-3 py-1.5 rounded-md text-sm capitalize transition-colors"
              style={{
                background: tab === s ? "var(--accent)" : "transparent",
                color: tab === s ? "var(--bg-primary)" : "var(--text-secondary)",
                fontWeight: tab === s ? 600 : 400,
              }}
            >
              {s}
              {counts[s] !== null && <span className="ml-1.5 tabular-nums opacity-80">{counts[s]}</span>}
            </button>
          ))}
        </div>
      </div>

      {items.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 mt-6 text-xs" style={{ color: "var(--text-muted)" }}>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? new Set() : new Set(items.map((w) => w.id)))}
              className="accent-[var(--accent)]"
            />
            Select all shown
          </label>
          <span className="hidden md:inline">
            Keys: ← → move · <b>A</b> {tab === "pending" ? "approve" : "restore"}
            {tab === "pending" && <> · <b>R</b> reject</>} · <b>Space</b> select · <b>Enter</b> preview
          </span>
        </div>
      )}

      {error && (
        <p className="mt-6 text-sm px-4 py-3 rounded-lg" style={{ color: "#ef4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
          {error}
        </p>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="mt-16 flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(129,238,78,0.12)", color: "var(--accent)" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{tab === "pending" ? "All caught up" : "Nothing rejected"}</p>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {tab === "pending" ? "No uploads are waiting for review." : "Rejected uploads show up here for 30 days."}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 mt-4">
        {items.map((w, i) => {
          const isBusy = busy.has(w.id);
          const isSel = selected.has(w.id);
          const focused = i === focus;
          return (
            <div
              key={w.id}
              ref={(el) => { cardRefs.current[i] = el; }}
              onClick={() => setFocus(i)}
              className="rounded-xl overflow-hidden flex flex-col transition-shadow"
              style={{
                background: "var(--bg-secondary)",
                border: `1px solid ${isSel ? "rgba(129,238,78,0.6)" : "var(--border)"}`,
                boxShadow: focused ? "0 0 0 2px var(--accent)" : undefined,
                opacity: isBusy ? 0.5 : 1,
              }}
            >
              <div className="relative cursor-zoom-in" style={{ background: w.dominantColor, aspectRatio: "3 / 4" }} onClick={() => setPreview(w)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={w.fileUrl} alt={w.title} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                <label
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-2 left-2 w-6 h-6 rounded-md flex items-center justify-center cursor-pointer"
                  style={{ background: "rgba(0,0,0,0.55)" }}
                >
                  <input type="checkbox" checked={isSel} onChange={() => toggleSelect(w.id)} className="accent-[var(--accent)]" />
                </label>
                <span className="absolute bottom-2 right-2 text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(0,0,0,0.6)", color: "#ddd" }}>
                  {w.width}×{w.height} · {fmtSize(w.fileSizeBytes)}
                </span>
              </div>

              <div className="p-3 flex flex-col gap-1.5 flex-1">
                <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }} title={w.title}>{w.title}</p>
                <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                  {w.uploader ? `@${w.uploader.username}` : "No uploader"} · {w.category?.name ?? "No category"} · {timeAgo(w.createdAt)}
                </p>
                {tab === "pending" && w.moderationReason && (
                  <p className="text-[11px] px-2 py-1 rounded" style={{ background: "rgba(234,179,8,0.10)", color: "#eab308" }}>
                    {w.moderationReason}
                  </p>
                )}
                {tab === "rejected" && (
                  <>
                    {w.reviewNote && <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>“{w.reviewNote}”</p>}
                    {w.purgeAt && <p className="text-[11px]" style={{ color: "#ef4444" }}>Deleted on {fmtDate(w.purgeAt)}</p>}
                  </>
                )}

                <div className="flex gap-2 mt-auto pt-1.5">
                  <button
                    disabled={isBusy}
                    onClick={() => void doApprove([w.id])}
                    className="flex-1 text-xs font-semibold py-2 rounded-lg transition-opacity hover:opacity-85 disabled:opacity-40"
                    style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
                  >
                    {tab === "pending" ? "Approve" : "Restore"}
                  </button>
                  {tab === "pending" && (
                    <button
                      disabled={isBusy}
                      onClick={() => setRejectTarget({ ids: [w.id] })}
                      className="flex-1 text-xs font-semibold py-2 rounded-lg transition-colors hover:bg-white/5 disabled:opacity-40"
                      style={{ border: "1px solid rgba(239,68,68,0.45)", color: "#ef4444" }}
                    >
                      Reject
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {loading &&
          Array.from({ length: items.length ? 4 : 10 }).map((_, i) => (
            <div key={`s${i}`} className="rounded-xl animate-pulse" style={{ background: "var(--bg-secondary)", aspectRatio: "3 / 5" }} />
          ))}
      </div>

      {hasMore && !loading && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => void load(tab, items.length)}
            className="text-sm px-4 py-2 rounded-lg transition-colors hover:bg-white/5"
            style={{ border: "1px solid var(--border-hover)", color: "var(--text-secondary)" }}
          >
            Load more
          </button>
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-4 left-0 right-0 md:left-60 z-40 flex justify-center px-4 pointer-events-none">
        <div
          className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl whitespace-nowrap"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-hover)", boxShadow: "0 16px 48px rgba(0,0,0,0.5)" }}
        >
          <span className="text-sm tabular-nums" style={{ color: "var(--text-primary)" }}>{selectedIds.length} selected</span>
          <button
            onClick={() => void doApprove(selectedIds)}
            className="text-xs font-semibold px-3 py-2 rounded-lg"
            style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
          >
            {tab === "pending" ? "Approve all" : "Restore all"}
          </button>
          {tab === "pending" && (
            <button
              onClick={() => setRejectTarget({ ids: selectedIds })}
              className="text-xs font-semibold px-3 py-2 rounded-lg"
              style={{ border: "1px solid rgba(239,68,68,0.45)", color: "#ef4444" }}
            >
              Reject all
            </button>
          )}
          <button onClick={() => setSelected(new Set())} className="text-xs px-2 py-2" style={{ color: "var(--text-muted)" }}>
            Clear
          </button>
        </div>
        </div>
      )}

      {preview && <PreviewModal item={preview} onClose={() => setPreview(null)} />}
      {rejectTarget && (
        <RejectModal
          count={rejectTarget.ids.length}
          busy={rejectTarget.ids.some((id) => busy.has(id))}
          onCancel={() => setRejectTarget(null)}
          onConfirm={(reason) => void doReject(rejectTarget.ids, reason)}
        />
      )}
    </div>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-full">{children}</div>
    </div>
  );
}

function PreviewModal({ item, onClose }: { item: ReviewItem; onClose: () => void }) {
  return (
    <Overlay onClose={onClose}>
      <div className="flex flex-col items-center gap-3 max-h-[92vh]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.fileUrl} alt={item.title} className="max-h-[80vh] max-w-[92vw] object-contain rounded-lg" />
        <div className="text-center">
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{item.title}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {item.width}×{item.height} · {item.format.toUpperCase()} · {item.tags.length ? item.tags.join(", ") : "no tags"}
          </p>
        </div>
      </div>
    </Overlay>
  );
}

function RejectModal({ count, busy, onCancel, onConfirm }: { count: number; busy: boolean; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  const valid = reason.trim().length >= 3 && reason.trim().length <= 300;
  return (
    <Overlay onClose={onCancel}>
      <div className="w-[min(440px,92vw)] rounded-xl p-5 flex flex-col gap-4" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-hover)" }}>
        <div>
          <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
            Reject {count === 1 ? "this wallpaper" : `${count} wallpapers`}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>Hidden right away. You can restore it for 30 days.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESET_REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className="text-xs px-2.5 py-1.5 rounded-full transition-colors"
              style={{
                border: `1px solid ${reason === r ? "var(--accent)" : "var(--border-hover)"}`,
                color: reason === r ? "var(--accent)" : "var(--text-secondary)",
              }}
            >
              {r}
            </button>
          ))}
        </div>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (3–300 characters)"
          rows={3}
          maxLength={300}
          autoFocus
          className="w-full rounded-lg px-3 py-2 text-sm resize-none outline-none"
          style={{ background: "var(--bg-secondary)", color: "var(--text-primary)", border: "1px solid var(--border-hover)" }}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && valid) onConfirm(reason.trim()); }}
        />
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="text-sm px-3 py-2 rounded-lg" style={{ color: "var(--text-secondary)" }}>Cancel</button>
          <button
            disabled={!valid || busy}
            onClick={() => onConfirm(reason.trim())}
            className="text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-40"
            style={{ background: "#ef4444", color: "#fff" }}
          >
            {busy ? "Rejecting…" : "Reject"}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
