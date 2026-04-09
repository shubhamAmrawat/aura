"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/authContext";
import {
  checkCollections,
  createCollection,
  addToCollection,
  removeFromCollection,
  type CollectionCheck,
} from "@/lib/collectionsApi";
import { useToast } from "@/lib/toast";

interface SaveToCollectionModalProps {
  wallpaperId: string;
  onClose: () => void;
}

const SaveToCollectionModal = ({ wallpaperId, onClose }: SaveToCollectionModalProps) => {
  const { token } = useAuth();
  const { toast } = useToast();

  const [collections, setCollections] = useState<CollectionCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newIsPublic, setNewIsPublic] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    checkCollections(token, wallpaperId)
      .then(setCollections)
      .catch(() => toast("Failed to load collections", "error"))
      .finally(() => setLoading(false));
  }, [token, wallpaperId]);

  const handleToggle = async (collection: CollectionCheck) => {
    if (!token) return;
    setSaving(collection.id);
    try {
      if (collection.hasWallpaper) {
        await removeFromCollection(token, collection.id, wallpaperId);
        setCollections((prev) =>
          prev.map((c) => c.id === collection.id ? { ...c, hasWallpaper: false } : c)
        );
        toast("Removed from collection");
      } else {
        await addToCollection(token, collection.id, wallpaperId);
        setCollections((prev) =>
          prev.map((c) => c.id === collection.id ? { ...c, hasWallpaper: true } : c)
        );
        toast("Saved to collection");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update collection", "error");
    } finally {
      setSaving(null);
    }
  };

  const handleCreate = async () => {
    if (!token || !newTitle.trim()) return;
    setCreating(true);
    try {
      const created = await createCollection(token, {
        title: newTitle.trim(),
        isPublic: newIsPublic,
      });
      // add wallpaper to new collection immediately
      await addToCollection(token, created.id, wallpaperId);
      setCollections((prev) => [
        { id: created.id, title: created.title, isPublic: created.isPublic, hasWallpaper: true },
        ...prev,
      ]);
      setNewTitle("");
      setNewIsPublic(false);
      setShowCreate(false);
      toast(`Saved to "${created.title}"`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to create collection", "error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      {/* backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* modal */}
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm rounded-2xl p-5"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        }}
      >
        {/* header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Save to collection
          </h3>
          <button
            onClick={onClose}
            className="text-xs transition-opacity hover:opacity-60"
            style={{ color: "var(--text-muted)" }}
          >
            ✕
          </button>
        </div>

        {/* collections list */}
        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto mb-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: "var(--bg-primary)" }} />
            ))
          ) : collections.length === 0 && !showCreate ? (
            <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>
              No collections yet. Create one below.
            </p>
          ) : (
            collections.map((col) => (
              <button
                key={col.id}
                onClick={() => handleToggle(col)}
                disabled={saving === col.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors hover:bg-white/5 disabled:opacity-50"
                style={{ border: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-2.5">
                  {/* checkbox */}
                  <div
                    className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                    style={{
                      background: col.hasWallpaper ? "var(--accent)" : "transparent",
                      border: col.hasWallpaper ? "none" : "1px solid var(--border)",
                    }}
                  >
                    {col.hasWallpaper && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--bg-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <span style={{ color: "var(--text-primary)" }}>{col.title}</span>
                </div>
                <span
                  className="text-[10px] tracking-wider uppercase"
                  style={{ color: "var(--text-muted)" }}
                >
                  {col.isPublic ? "Public" : "Private"}
                </span>
              </button>
            ))
          )}
        </div>

        {/* create new */}
        {showCreate ? (
          <div className="flex flex-col gap-2 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Collection name"
              autoFocus
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                background: "var(--bg-primary)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />

            {/* public/private toggle */}
            <button
              onClick={() => setNewIsPublic((v) => !v)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors hover:bg-white/5"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            >
              <div
                className="w-4 h-4 rounded flex items-center justify-center"
                style={{
                  background: newIsPublic ? "var(--accent)" : "transparent",
                  border: newIsPublic ? "none" : "1px solid var(--border)",
                }}
              >
                {newIsPublic && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--bg-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              Make public
            </button>

            <div className="flex gap-2">
              <button
                onClick={() => { setShowCreate(false); setNewTitle(""); }}
                className="flex-1 py-2 rounded-lg text-xs"
                style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newTitle.trim()}
                className="flex-1 py-2 rounded-lg text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
              >
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors hover:bg-white/5"
            style={{ border: "1px dashed var(--border)", color: "var(--text-muted)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New collection
          </button>
        )}
      </div>
    </>
  );
};

export default SaveToCollectionModal;