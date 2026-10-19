"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  deleteUpload,
  getUserUploads,
  updateUpload,
  type UpdateUploadPayload,
  type UploadStatus,
  type UserUpload,
} from "@/lib/profileApi";
import { useToast } from "@/lib/toast";
import { ChevronDownIcon, CloudUploadIcon, SquarePenIcon, Trash2Icon, XIcon } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────

interface Category {
  id: string;
  name: string;
  slug: string;
}

// ─── Icons ───────────────────────────────────────────────────

function IcEdit() {
  return (
    <SquarePenIcon size={13} strokeWidth={2} aria-hidden="true" />
  );
}

function IcTrash() {
  return (
    <Trash2Icon size={13} strokeWidth={2} aria-hidden="true" />
  );
}

function IcChevronDown() {
  return (
    <ChevronDownIcon size={14} strokeWidth={2} aria-hidden="true" />
  );
}

function IcUploadCloud() {
  return (
    <CloudUploadIcon size={32} strokeWidth={1.5} aria-hidden="true" />
  );
}

function IcX() {
  return (
    <XIcon size={16} strokeWidth={2} aria-hidden="true" />
  );
}

// ─── Status badge ────────────────────────────────────────────

const STATUS_CONFIG: Record<UploadStatus, { label: string; bg: string; color: string }> = {
  approved: { label: "Live", bg: "rgba(64,192,87,0.88)", color: "#fff" },
  pending: { label: "In review", bg: "rgba(234,179,8,0.92)", color: "#1a1400" },
  rejected: { label: "Rejected", bg: "rgba(239,68,68,0.9)", color: "#fff" },
};

function StatusBadge({ status }: { status: UploadStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span
      className="text-[11px] px-2.5 py-1 rounded-full font-semibold"
      style={{ background: cfg.bg, color: cfg.color, backdropFilter: "blur(4px)" }}
    >
      {cfg.label}
    </span>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────

interface EditModalProps {
  upload: UserUpload;
  categories: Category[];
  onSave: (updated: UserUpload) => void;
  onClose: () => void;
}

function EditModal({ upload, categories, onSave, onClose }: EditModalProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState(upload.title);
  const [description, setDescription] = useState(upload.description ?? "");
  const [tagInput, setTagInput] = useState(upload.tags.join(", "));
  const [categoryId, setCategoryId] = useState(upload.categoryId ?? "");
  const [saving, setSaving] = useState(false);

  const inputStyle: React.CSSProperties = {
    background: "var(--bg-primary)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
    outline: "none",
    width: "100%",
    padding: "0.65rem 0.875rem",
    borderRadius: "0.5rem",
    fontSize: "0.875rem",
  };

  async function handleSave() {
    if (!title.trim()) { toast("Title is required.", "error"); return; }
    setSaving(true);
    try {
      const tags = tagInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const payload: UpdateUploadPayload = {
        title: title.trim(),
        description: description.trim() || null,
        tags,
        categoryId: categoryId || null,
      };
      const updated = await updateUpload(upload.id, payload);
      onSave(updated);
      toast("Wallpaper updated.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update.", "error");
    } finally {
      setSaving(false);
    }
  }

  // Close on backdrop click
  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-xl rounded-2xl overflow-hidden flex flex-col"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", boxShadow: "0 24px 64px rgba(0,0,0,0.5)", maxHeight: "92vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Edit wallpaper</h2>
            <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "var(--text-muted)" }}>{upload.title}</p>
          </div>
          <button onClick={onClose} aria-label="Close edit modal" className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-white/5" style={{ color: "var(--text-muted)" }}>
            <IcX />
          </button>
        </div>

        {/* Scrollable body: preview + fields */}
        <div className="overflow-y-auto flex-1">

        {/* Wallpaper preview — natural aspect ratio, scaled to fit, never cropped */}
        <div
          className="flex items-center justify-center w-full"
          style={{ background: "var(--bg-primary)", borderBottom: "1px solid var(--border)", maxHeight: 320, overflow: "hidden" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={upload.thumbUrl || upload.fileUrl}
            alt={upload.title}
            style={{
              maxWidth: "100%",
              maxHeight: 300,
              width: "auto",
              height: "auto",
              display: "block",
              objectFit: "contain",
            }}
          />
        </div>

        {/* Form fields */}
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[10px] tracking-widest uppercase mb-1.5 block" style={{ color: "var(--text-muted)" }}>Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Wallpaper title"
              style={inputStyle}
              maxLength={120}
            />
          </div>

          <div>
            <label className="text-[10px] tracking-widest uppercase mb-1.5 block" style={{ color: "var(--text-muted)" }}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description…"
              rows={3}
              style={{ ...inputStyle, resize: "none" }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] tracking-widest uppercase mb-1.5 block" style={{ color: "var(--text-muted)" }}>
                Tags <span style={{ opacity: 0.55 }}>(comma-separated)</span>
              </label>
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="dark, minimal, nature"
                style={inputStyle}
              />
            </div>

            {categories.length > 0 && (
              <div>
                <label htmlFor="edit-category" className="text-[10px] tracking-widest uppercase mb-1.5 block" style={{ color: "var(--text-muted)" }}>Category</label>
                <select
                  id="edit-category"
                  aria-label="Select category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  style={{ ...inputStyle, cursor: "pointer" }}
                >
                  <option value="">— No category —</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        </div>{/* end scrollable body */}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium transition-opacity hover:opacity-70"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="px-5 py-2 rounded-lg text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Upload Card ──────────────────────────────────────────────

interface UploadCardProps {
  upload: UserUpload;
  onEdit: (upload: UserUpload) => void;
  onDeleted: (id: string) => void;
}

function UploadCard({ upload, onEdit, onDeleted }: UploadCardProps) {
  const { toast } = useToast();
  const [hovered, setHovered] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteUpload(upload.id);
      onDeleted(upload.id);
      toast("Wallpaper deleted.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete.", "error");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <Link
      href={`/wallpaper/${upload.id}`}
      className="relative group rounded-2xl overflow-hidden block"
      style={{ backgroundColor: upload.dominantColor, aspectRatio: upload.width && upload.height ? `${upload.width} / ${upload.height}` : "3 / 4" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setConfirmDelete(false); }}
    >
      {/* Thumbnail */}
      <Image
        src={upload.thumbUrl || upload.fileUrl}
        alt={upload.title}
        fill
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
        className="object-cover transition-transform duration-500 group-hover:scale-105"
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Status badge — only for uploads that aren't live yet */}
      {upload.status !== "approved" && (
        <div className="absolute top-2.5 left-2.5">
          <StatusBadge status={upload.status} />
        </div>
      )}

      {/* Hover overlay */}
      <div
        className="absolute inset-0 flex flex-col justify-between p-2.5 transition-opacity duration-200"
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)",
          opacity: hovered ? 1 : 0,
        }}
      >
        {/* Top-right actions — stopPropagation keeps the card Link from firing */}
        <div className="flex justify-end gap-1.5">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(upload); }}
            className="flex items-center justify-center w-8 h-8 rounded-full transition-colors"
            style={{ background: "rgba(10,10,10,0.55)", color: "#fff", backdropFilter: "blur(6px)" }}
            title="Edit"
            aria-label="Edit details"
          >
            <IcEdit />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete(true); }}
            className="flex items-center justify-center w-8 h-8 rounded-full transition-colors"
            style={{ background: "rgba(10,10,10,0.55)", color: "#f87171", backdropFilter: "blur(6px)" }}
            title="Delete"
            aria-label="Delete wallpaper"
          >
            <IcTrash />
          </button>
        </div>

        {/* Bottom: title */}
        <div>
          <p className="text-[13px] font-medium line-clamp-2 leading-snug" style={{ color: "#fff" }}>
            {upload.title}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.7)" }}>
              ♥ {upload.likeCount}
            </span>
            <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.7)" }}>
              ↓ {upload.downloadCount}
            </span>
          </div>
        </div>
      </div>

      {/* Delete confirmation overlay */}
      {confirmDelete && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-3"
          style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(4px)" }}
        >
          <p className="text-xs text-center font-medium" style={{ color: "#fff" }}>
            Delete this wallpaper?
          </p>
          <p className="text-[10px] text-center" style={{ color: "rgba(255,255,255,0.5)" }}>
            This cannot be undone.
          </p>
          <div className="flex gap-2 w-full">
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete(false); }}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium"
              style={{ border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}
            >
              Cancel
            </button>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(); }}
              disabled={deleting}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
              style={{ background: "#ef4444", color: "#fff" }}
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      )}
    </Link>
  );
}

// ─── Main Section ─────────────────────────────────────────────

interface Props {
  isCreator: boolean;
  onUploadCountChange?: (delta: number) => void;
}

export default function UserUploadsSection({ isCreator, onUploadCountChange }: Props) {
  const { toast } = useToast();
  const [uploads, setUploads] = useState<UserUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editTarget, setEditTarget] = useState<UserUpload | null>(null);
  const LIMIT = 24;

  // Fetch categories once for the edit modal
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return;
    fetch(`${apiUrl}/api/categories`, { credentials: "include" })
      .then((r) => r.json())
      .then((json) => setCategories(json.data ?? []))
      .catch(() => {});
  }, []);

  // Initial fetch
  useEffect(() => {
    getUserUploads({ limit: LIMIT, offset: 0 })
      .then(({ data, hasMore }) => {
        setUploads(data);
        setHasMore(hasMore);
        setOffset(LIMIT);
      })
      .catch(() => toast("Failed to load uploads.", "error"))
      .finally(() => setLoading(false));
  }, [toast]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const { data, hasMore: more } = await getUserUploads({ limit: LIMIT, offset });
      setUploads((prev) => [...prev, ...data]);
      setHasMore(more);
      setOffset((o) => o + LIMIT);
    } catch {
      toast("Failed to load more.", "error");
    } finally {
      setLoadingMore(false);
    }
  }

  const handleDeleted = useCallback((id: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== id));
    onUploadCountChange?.(-1);
  }, [onUploadCountChange]);

  const handleSaved = useCallback((updated: UserUpload) => {
    setUploads((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    setEditTarget(null);
  }, []);

  // Don't render section at all if not a creator and has no uploads
  if (!loading && !isCreator && uploads.length === 0) return null;

  return (
    <>
      {editTarget && (
        <EditModal
          upload={editTarget}
          categories={categories}
          onSave={handleSaved}
          onClose={() => setEditTarget(null)}
        />
      )}

      <div>
        {loading ? (
          <div className="columns-2 sm:columns-3 md:columns-4 xl:columns-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="break-inside-avoid mb-4 rounded-2xl animate-pulse" style={{ background: "var(--bg-elevated)", aspectRatio: i % 3 === 0 ? "16 / 10" : "3 / 4" }} />
            ))}
          </div>
        ) : uploads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 rounded-3xl" style={{ border: "1px dashed var(--border-hover)" }}>
            <div className="mb-4" style={{ color: "var(--text-muted)" }}>
              <IcUploadCloud />
            </div>
            <p className="text-base font-medium mb-1" style={{ color: "var(--text-primary)" }}>No uploads yet</p>
            <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>
              Share your wallpapers with the Aurora community.
            </p>
            {isCreator && (
              <Link
                href="/upload"
                className="h-11 px-5 rounded-full text-sm font-semibold flex items-center transition-opacity hover:opacity-90"
                style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
              >
                Upload your first wallpaper
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="columns-2 sm:columns-3 md:columns-4 xl:columns-5 gap-4">
              {uploads.map((upload) => (
                <div key={upload.id} className="break-inside-avoid mb-4">
                  <UploadCard upload={upload} onEdit={setEditTarget} onDeleted={handleDeleted} />
                </div>
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2.5 h-11 px-5 rounded-full text-sm font-medium transition-colors hover:bg-white/[0.04] disabled:opacity-40"
                  style={{ border: "1px solid var(--border-hover)", color: "var(--text-secondary)" }}
                >
                  {loadingMore ? (
                    <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(255,255,255,0.2)", borderTopColor: "var(--text-secondary)" }} />
                  ) : (
                    <IcChevronDown />
                  )}
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
