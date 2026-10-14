"use client";

import { useEffect, useMemo, useState } from "react";
import ExtraCategories from "../_components/ExtraCategories";
import {
  approveWallpaper,
  deleteAdminWallpaper,
  getAdminWallpaper,
  rejectWallpaper,
  updateAdminWallpaper,
  type AdminWallpaperDetail,
  type CategoryOption,
  type WallpaperPatch,
  resolutionOf,
} from "@/lib/adminApi";
import { useToast } from "@/lib/toast";
import { ConfirmDialog, Modal, StatusBadge, Toggle, inputStyle } from "../_components/ui";
import WallpaperLightbox from "../_components/WallpaperLightbox";

const fmt = (n: number) => new Intl.NumberFormat("en-IN").format(n);
const fmtDate = (iso: string) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

type Form = {
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  extraCategoryIds: string[];
  isFeatured: boolean;
  isPremium: boolean;
  isMobile: boolean;
  isAiGenerated: boolean;
};

const toForm = (w: AdminWallpaperDetail): Form => ({
  title: w.title,
  description: w.description ?? "",
  tags: w.tags,
  categoryId: w.category?.id ?? "",
  extraCategoryIds: (w.extraCategories ?? []).map((c) => c.id),
  isFeatured: w.isFeatured,
  isPremium: w.isPremium,
  isMobile: w.isMobile,
  isAiGenerated: w.isAiGenerated,
});

/** Side panel to view and edit one wallpaper. Calls onChanged after any save/status change, onDeleted after delete. */
export default function EditDrawer({ id, categories, onClose, onChanged, onDeleted }: {
  id: string;
  categories: CategoryOption[];
  onClose: () => void;
  onChanged: (w: AdminWallpaperDetail) => void;
  onDeleted: (id: string) => void;
}) {
  const { toast } = useToast();
  const [w, setW] = useState<AdminWallpaperDetail | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [statusBusy, setStatusBusy] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    let alive = true;
    setW(null);
    setForm(null);
    setError("");
    getAdminWallpaper(id)
      .then((d) => { if (alive) { setW(d); setForm(toForm(d)); } })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Failed to load"));
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !confirmDelete && !rejecting && !previewing) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, confirmDelete, rejecting, previewing]);

  const patch = useMemo<WallpaperPatch>(() => {
    if (!w || !form) return {};
    const p: WallpaperPatch = {};
    if (form.title.trim() !== w.title) p.title = form.title.trim();
    if ((form.description.trim() || null) !== w.description) p.description = form.description.trim() || null;
    if (form.tags.join("\u0000") !== w.tags.join("\u0000")) p.tags = form.tags;
    if ((form.categoryId || null) !== (w.category?.id ?? null)) p.categoryId = form.categoryId || null;
    const extras = form.extraCategoryIds.filter((id) => id !== form.categoryId);
    if (extras.join() !== (w.extraCategories ?? []).map((c) => c.id).join()) p.extraCategoryIds = extras;
    for (const k of ["isFeatured", "isPremium", "isMobile", "isAiGenerated"] as const) if (form[k] !== w[k]) p[k] = form[k];
    return p;
  }, [w, form]);
  const dirty = Object.keys(patch).length > 0;
  const titleValid = !!form && form.title.trim().length > 0 && form.title.trim().length <= 120;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const addTags = (raw: string) => {
    if (!form) return;
    const next = [...form.tags];
    for (const t of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
      if (t.length <= 40 && next.length < 30 && !next.some((x) => x.toLowerCase() === t.toLowerCase())) next.push(t);
    }
    set("tags", next);
    setTagDraft("");
  };

  const save = async () => {
    if (!dirty || !titleValid) return;
    setSaving(true);
    setError("");
    try {
      const updated = await updateAdminWallpaper(id, patch);
      setW(updated);
      setForm(toForm(updated));
      onChanged(updated);
      toast("Saved.", "success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const reload = async () => {
    const d = await getAdminWallpaper(id);
    setW(d);
    setForm(toForm(d));
    onChanged(d);
  };

  const doApprove = async () => {
    setStatusBusy(true);
    try {
      await approveWallpaper(id);
      await reload();
      toast(w?.status === "rejected" ? "Restored — it's live again." : "Approved — it's live.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setStatusBusy(false);
    }
  };

  const doReject = async () => {
    setStatusBusy(true);
    try {
      await rejectWallpaper(id, reason.trim());
      setRejecting(false);
      setReason("");
      await reload();
      toast("Rejected — hidden, deleted in 30 days.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setStatusBusy(false);
    }
  };

  const doDelete = async () => {
    setStatusBusy(true);
    try {
      await deleteAdminWallpaper(id);
      toast("Deleted.", "success");
      onDeleted(id);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete", "error");
      setStatusBusy(false);
      setConfirmDelete(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose} />
      <aside
        className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[480px] flex flex-col"
        style={{ background: "var(--bg-secondary)", borderLeft: "1px solid var(--border-hover)", boxShadow: "-16px 0 48px rgba(0,0,0,0.4)" }}
        aria-label="Edit wallpaper"
      >
        <div className="flex items-center justify-between px-5 h-14 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 min-w-0">
            <p className="font-semibold truncate" style={{ color: "var(--text-primary)" }}>Edit wallpaper</p>
            {w && <StatusBadge status={w.status} />}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5" style={{ color: "var(--text-secondary)" }} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {!w || !form ? (
          <div className="flex-1 flex items-center justify-center">
            {error
              ? <p className="text-sm px-5 text-center" style={{ color: "#ef4444" }}>{error}</p>
              : <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "var(--border-hover)", borderTopColor: "var(--accent)" }} />}
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
              <div className="flex gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={w.thumbUrl ?? w.fileUrl}
                  alt={w.title}
                  onClick={() => setPreviewing(true)}
                  className="w-28 rounded-lg object-cover shrink-0 cursor-zoom-in transition-opacity hover:opacity-85"
                  style={{ background: w.dominantColor, aspectRatio: `${w.width} / ${w.height}`, maxHeight: 200 }}
                  title="View full size"
                />
                <div className="min-w-0 flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                  <p>{w.width}×{w.height} ({resolutionOf(w.width, w.height).label}) · {w.format.toUpperCase()} · {w.fileSizeBytes >= 1048576 ? `${(w.fileSizeBytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(w.fileSizeBytes / 1024))} KB`}</p>
                  <p>By {w.uploader ? `@${w.uploader.username}` : "no uploader (seeded)"}</p>
                  <p>Added {fmtDate(w.createdAt)}</p>
                  <p className="mt-1" style={{ color: "var(--text-muted)" }}>
                    {fmt(w.downloadCount)} downloads · {fmt(w.likeCount)} likes · {fmt(w.viewCount)} views
                  </p>
                  <p style={{ color: w.hasTextEmbedding ? "var(--text-muted)" : "#eab308" }}>
                    {w.hasTextEmbedding ? "In search" : "Not in search yet"} · {w.hasVisionEmbedding ? "Similar-vibes ready" : "No similar-vibes data"}
                  </p>
                  <button onClick={() => setPreviewing(true)} className="mt-1 self-start hover:underline" style={{ color: "var(--accent)" }}>
                    View full size
                  </button>
                </div>
              </div>

              {/* Status */}
              <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Status</span>
                  <div className="flex gap-2">
                    {w.status !== "approved" && w.status !== "hidden" && (
                      <button disabled={statusBusy} onClick={doApprove} className="text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-40" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>
                        {w.status === "rejected" ? "Restore" : "Approve"}
                      </button>
                    )}
                    {w.status !== "rejected" && w.status !== "hidden" && (
                      <button disabled={statusBusy} onClick={() => setRejecting(true)} className="text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-40" style={{ border: "1px solid rgba(239,68,68,0.45)", color: "#ef4444" }}>
                        {w.status === "approved" ? "Unpublish" : "Reject"}
                      </button>
                    )}
                  </div>
                </div>
                {w.status === "hidden" && (
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    Hidden because the uploader&apos;s account is disabled. Re-enable the account in Users to show it again.
                  </p>
                )}
                {w.moderationReason && <p className="text-xs" style={{ color: "#eab308" }}>Auto-check: {w.moderationReason}</p>}
                {w.status === "rejected" && w.reviewNote && <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Rejected: “{w.reviewNote}”</p>}
                {w.reviewedAt && <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Last reviewed {fmtDate(w.reviewedAt)}</p>}
              </div>

              {/* Details */}
              <label className="flex flex-col gap-1.5">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Title</span>
                <input value={form.title} maxLength={120} onChange={(e) => set("title", e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={{ ...inputStyle, borderColor: titleValid ? "var(--border-hover)" : "#ef4444" }} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Description</span>
                <textarea value={form.description} maxLength={1000} rows={3} onChange={(e) => set("description", e.target.value)} className="rounded-lg px-3 py-2 text-sm resize-none" style={inputStyle} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Category</span>
                <select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={inputStyle}>
                  <option value="">No category</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Also shown in <span className="opacity-70">(up to 2 more categories)</span></span>
                <ExtraCategories
                  value={form.extraCategoryIds}
                  primaryId={form.categoryId || null}
                  categories={categories}
                  onChange={(ids) => set("extraCategoryIds", ids)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Tags · {form.tags.length}/30</span>
                <div className="rounded-lg p-2 flex flex-wrap gap-1.5" style={inputStyle}>
                  {form.tags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md" style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
                      {t}
                      <button onClick={() => set("tags", form.tags.filter((x) => x !== t))} aria-label={`Remove ${t}`} className="opacity-60 hover:opacity-100">×</button>
                    </span>
                  ))}
                  <input
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.key === "Enter" || e.key === ",") && tagDraft.trim()) { e.preventDefault(); addTags(tagDraft); }
                      else if (e.key === "Backspace" && !tagDraft && form.tags.length) set("tags", form.tags.slice(0, -1));
                    }}
                    onBlur={() => tagDraft.trim() && addTags(tagDraft)}
                    placeholder={form.tags.length ? "" : "Add tags (Enter or comma)"}
                    className="flex-1 min-w-[120px] bg-transparent text-sm outline-none px-1"
                    style={{ color: "var(--text-primary)" }}
                  />
                </div>
              </div>
              <div className="flex flex-col">
                <Toggle label={form.isMobile ? "Featured (app's Featured row)" : "Featured (website home page)"} checked={form.isFeatured} onChange={(v) => set("isFeatured", v)} />
                <Toggle label="Premium" checked={form.isPremium} onChange={(v) => set("isPremium", v)} />
                <Toggle label={form.isMobile ? "Mobile wallpaper (portrait)" : "Desktop wallpaper (landscape)"} checked={form.isMobile} onChange={(v) => set("isMobile", v)} />
                <Toggle label="AI-generated" checked={form.isAiGenerated} onChange={(v) => set("isAiGenerated", v)} />
              </div>
              {error && <p className="text-sm" style={{ color: "#ef4444" }}>{error}</p>}
            </div>

            <div className="flex items-center justify-between gap-2 px-5 py-3 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
              <button onClick={() => setConfirmDelete(true)} className="text-sm px-3 py-2 rounded-lg hover:bg-white/5" style={{ color: "#ef4444" }}>
                Delete
              </button>
              <div className="flex gap-2">
                <button disabled={!dirty || saving} onClick={() => setForm(toForm(w))} className="text-sm px-3 py-2 rounded-lg hover:bg-white/5 disabled:opacity-40" style={{ color: "var(--text-secondary)" }}>
                  Reset
                </button>
                <button disabled={!dirty || !titleValid || saving} onClick={save} className="text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-40" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          </>
        )}
      </aside>

      {previewing && w && <WallpaperLightbox wallpaper={w} onClose={() => setPreviewing(false)} />}

      {confirmDelete && w && (
        <ConfirmDialog
          title="Delete this wallpaper?"
          body={<>“{w.title}” and its likes, downloads and collection entries will be removed for good. This can&apos;t be undone.</>}
          confirmLabel="Delete"
          danger
          busy={statusBusy}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={doDelete}
        />
      )}

      {rejecting && w && (
        <Modal onClose={() => setRejecting(false)} busy={statusBusy}>
          <div>
            <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{w.status === "approved" ? "Unpublish" : "Reject"} this wallpaper</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>Hidden right away. You can restore it for 30 days.</p>
          </div>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (3–300 characters)" rows={3} maxLength={300} autoFocus className="rounded-lg px-3 py-2 text-sm resize-none" style={inputStyle} />
          <div className="flex justify-end gap-2">
            <button onClick={() => setRejecting(false)} className="text-sm px-3 py-2 rounded-lg" style={{ color: "var(--text-secondary)" }}>Cancel</button>
            <button disabled={reason.trim().length < 3 || statusBusy} onClick={doReject} className="text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-40" style={{ background: "#ef4444", color: "#fff" }}>
              {statusBusy ? "Working…" : w.status === "approved" ? "Unpublish" : "Reject"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
