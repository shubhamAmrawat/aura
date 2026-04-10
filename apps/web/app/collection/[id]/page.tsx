"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/authContext";
import { getCollection, deleteCollection, updateCollection, removeFromCollection } from "@/lib/collectionsApi";
import { useToast } from "@/lib/toast";
import WallpaperCard from "@/app/components/WallpaperCard";
import type { Wallpaper } from "@aura/types";

/** Minimal shape returned for wallpapers in a collection detail response */
interface CollectionWallpaperRow {
  id: string;
  title: string;
  fileUrl: string;
  blurhash: string;
  dominantColor: string;
  width: number;
  height: number;
  likeCount: number;
  downloadCount: number;
  addedAt?: string;
}

function wallpaperForCard(w: CollectionWallpaperRow): Wallpaper {
  return {
    ...w,
    description: null,
    palette: [],
    tags: [],
    fileSizeBytes: 0,
    format: "jpeg",
    createdAt: w.addedAt ?? new Date().toISOString(),
    isPremium: false,
    isFeatured: false,
  };
}

interface CollectionData {
  id: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  userId: string;
  coverWallpaperId: string | null;
  createdAt: string;
  wallpaperCount: number;
}

export default function CollectionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, token } = useAuth();
  const { toast } = useToast();

  const [collection, setCollection] = useState<CollectionData | null>(null);
  const [wallpapers, setWallpapers] = useState<CollectionWallpaperRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  // edit state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIsPublic, setEditIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  // delete state
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    getCollection(token, id)
      .then(({ collection: col, wallpapers: walls }) => {
        setCollection(col);
        setWallpapers(walls);
        setIsOwner(!!user && user.id === col.userId);
        setEditTitle(col.title);
        setEditDescription(col.description ?? "");
        setEditIsPublic(col.isPublic);
      })
      .catch((err) => {
        toast(err instanceof Error ? err.message : "Failed to load collection", "error");
      })
      .finally(() => setLoading(false));
  }, [id, token, user]);

  const handleSave = async () => {
    if (!token || !collection) return;
    setSaving(true);
    try {
      const updated = await updateCollection(token, collection.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        isPublic: editIsPublic,
      });
      setCollection((prev) => prev ? { ...prev, ...updated } : prev);
      setEditing(false);
      toast("Collection updated.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!token || !collection) return;
    setDeleting(true);
    try {
      await deleteCollection(token, collection.id);
      toast("Collection deleted.");
      router.push("/profile");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete", "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleRemoveWallpaper = async (wallpaperId: string) => {
    if (!token || !collection) return;
    try {
      await removeFromCollection(token, collection.id, wallpaperId);
      setWallpapers((prev) => prev.filter((w) => w.id !== wallpaperId));
      setCollection((prev) => prev ? { ...prev, wallpaperCount: prev.wallpaperCount - 1 } : prev);
      toast("Removed from collection.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to remove", "error");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-24 px-8" style={{ background: "var(--bg-primary)" }}>
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse mb-8">
            <div className="h-8 w-64 rounded mb-3" style={{ background: "var(--bg-elevated)" }} />
            <div className="h-4 w-40 rounded" style={{ background: "var(--bg-elevated)" }} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-2xl animate-pulse" style={{ background: "var(--bg-elevated)" }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <div className="text-center">
          <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>Collection not found</p>
          <Link href="/" className="text-xs" style={{ color: "var(--accent)" }}>← Back to home</Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen pt-20" style={{ background: "var(--bg-primary)" }}>
      <div className="max-w-6xl mx-auto px-8 py-8">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-4">
            {/* <Link
              href="/profile"
              className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-60"
              style={{ color: "var(--text-muted)" }}
            >
              ← Back
            </Link> */}
            {!editing && (
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                    {collection.title}
                  </h1>
                  <span
                    className="text-[10px] tracking-wider uppercase px-2 py-0.5 rounded-full"
                    style={{
                      background: collection.isPublic ? "rgba(64,192,87,0.15)" : "var(--bg-elevated)",
                      color: collection.isPublic ? "var(--accent)" : "var(--text-muted)",
                      border: collection.isPublic ? "1px solid rgba(64,192,87,0.3)" : "1px solid var(--border)",
                    }}
                  >
                    {collection.isPublic ? "Public" : "Private"}
                  </span>
                </div>
                {collection.description && (
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{collection.description}</p>
                )}
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  {collection.wallpaperCount} wallpaper{collection.wallpaperCount !== 1 ? "s" : ""}
                </p>
              </div>
            )}
          </div>

          {/* owner actions */}
          {isOwner && !editing && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
                style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              >
                Edit
              </button>
              <button
                onClick={() => setShowDelete(true)}
                className="px-4 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
                style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {/* ── Edit form ── */}
        {editing && (
          <div
            className="rounded-2xl p-5 mb-8"
            style={{ border: "1px solid var(--border)", background: "var(--bg-elevated)" }}
          >
            <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Edit collection</h3>
            <div className="flex flex-col gap-3 max-w-md">
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Collection title"
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
              />
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none resize-none"
                style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
              />
              <button
                onClick={() => setEditIsPublic((v) => !v)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm transition-colors hover:bg-white/5 w-fit"
                style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              >
                <div
                  className="w-4 h-4 rounded flex items-center justify-center"
                  style={{
                    background: editIsPublic ? "var(--accent)" : "transparent",
                    border: editIsPublic ? "none" : "1px solid var(--border)",
                  }}
                >
                  {editIsPublic && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--bg-primary)" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                Make public
              </button>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => setEditing(false)}
                  className="flex-1 py-2 rounded-lg text-xs"
                  style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !editTitle.trim()}
                  className="flex-1 py-2 rounded-lg text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
                  style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Wallpapers grid ── */}
        {wallpapers.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-24 rounded-2xl"
            style={{ border: "1px dashed var(--border)" }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-4" style={{ color: "var(--text-muted)" }}>
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            <p className="text-sm mb-1" style={{ color: "var(--text-muted)" }}>This collection is empty</p>
            <Link href="/" className="text-xs mt-2 transition-opacity hover:opacity-70" style={{ color: "var(--accent)" }}>
              Browse wallpapers →
            </Link>
          </div>
        ) : (
          <div className="columns-2 sm:columns-3 md:columns-4 xl:columns-5 gap-4">
            {wallpapers.map((w) => (
              <div key={w.id} className="break-inside-avoid mb-4">
                <div className="relative group/item">
                  <WallpaperCard wallpaper={wallpaperForCard(w)} />
                  {/* remove button — owner only */}
                  {isOwner && (
                    <button
                      onClick={() => handleRemoveWallpaper(w.id)}
                      className="absolute top-2 left-2 z-20 flex items-center justify-center w-7 h-7 rounded-full opacity-0 group-hover/item:opacity-100 transition-all duration-200"
                      style={{
                        background: "rgba(239,68,68,0.85)",
                        backdropFilter: "blur(8px)",
                      }}
                      title="Remove from collection"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Delete confirm ── */}
        {showDelete && (
          <>
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setShowDelete(false)} />
            <div
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm rounded-2xl p-6"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
            >
              <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Delete collection?</h3>
              <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
                This will permanently delete "{collection.title}" and remove all {collection.wallpaperCount} wallpapers from it. The wallpapers themselves won't be deleted.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDelete(false)}
                  className="flex-1 py-2.5 rounded-lg text-sm"
                  style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
                  style={{ background: "#ef4444", color: "#fff" }}
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}