"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import {
  checkCollections,
  createCollection,
  addToCollection,
  removeFromCollection,
  type CollectionCheck,
} from "@/lib/collectionsApi";
import { useToast } from "@/lib/toast";

interface BookmarkButtonProps {
  wallpaperId: string;
  size?: "sm" | "md";
  variant?: "card" | "detail";
  onDropdownChange?: (open: boolean) => void;
}

interface DropdownPos {
  top: number;
  left: number;
  right: number;
  alignRight: boolean;
}

const BookmarkButton = ({
  wallpaperId,
  size = "md",
  variant = "detail",
  onDropdownChange,
}: BookmarkButtonProps) => {
  const { user, savedIds, toggleSavedId } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const buttonRef = useRef<HTMLButtonElement>(null);

  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState<CollectionCheck[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newIsPublic, setNewIsPublic] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<DropdownPos>({
    top: 0,
    left: 0,
    right: 0,
    alignRight: false,
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Derive isSaved: use loaded collections when available, otherwise fall back to
  // the global savedIds set (which is populated from the API on every page load).
  const isSaved = loaded
    ? collections.some((c) => c.hasWallpaper)
    : savedIds.has(wallpaperId);

  const loadCollections = useCallback(async () => {
    if (!user || loading) return;
    setLoading(true);
    try {
      const data = await checkCollections(wallpaperId);
      setCollections(data);
      setLoaded(true);
    } catch {
      toast("Failed to load collections", "error");
    } finally {
      setLoading(false);
    }
  }, [user, wallpaperId, loading, toast]);

  // Detail page: eagerly load so the dropdown is ready instantly on open
  useEffect(() => {
    if (variant === "detail" && user && !loaded) {
      loadCollections();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, user]);

  const computePos = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 8,
      left: rect.left,
      right: window.innerWidth - rect.right,
      alignRight: window.innerWidth - rect.left < 264,
    });
  }, []);

  // Re-anchor the dropdown on every scroll / resize while it's open
  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", computePos, true);
    window.addEventListener("resize", computePos);
    return () => {
      window.removeEventListener("scroll", computePos, true);
      window.removeEventListener("resize", computePos);
    };
  }, [open, computePos]);

  // Notify parent so it can keep action buttons visible while dropdown is open
  useEffect(() => {
    onDropdownChange?.(open);
  }, [open, onDropdownChange]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      router.push("/login");
      return;
    }

    if (!open) {
      computePos();
      if (!loaded) loadCollections();
    } else {
      setShowCreate(false);
      setNewTitle("");
    }
    setOpen((prev) => !prev);
  };

  const handleClose = useCallback(() => {
    setOpen(false);
    setShowCreate(false);
    setNewTitle("");
  }, []);

  const syncSavedId = useCallback(
    (nextCollections: CollectionCheck[]) => {
      const nowSaved = nextCollections.some((c) => c.hasWallpaper);
      const wasSaved = savedIds.has(wallpaperId);
      if (nowSaved !== wasSaved) toggleSavedId(wallpaperId);
    },
    [savedIds, wallpaperId, toggleSavedId]
  );

  const handleToggle = async (collection: CollectionCheck) => {
    if (!user) return;
    setSaving(collection.id);
    try {
      let next: CollectionCheck[];
      if (collection.hasWallpaper) {
        await removeFromCollection(collection.id, wallpaperId);
        next = collections.map((c) =>
          c.id === collection.id ? { ...c, hasWallpaper: false } : c
        );
        toast(`Removed from ${collection.title}`);
      } else {
        await addToCollection(collection.id, wallpaperId);
        next = collections.map((c) =>
          c.id === collection.id ? { ...c, hasWallpaper: true } : c
        );
        toast(`Saved to ${collection.title}`);
      }
      setCollections(next);
      syncSavedId(next);
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Failed to update collection",
        "error"
      );
    } finally {
      setSaving(null);
    }
  };

  const handleCreate = async () => {
    if (!user || !newTitle.trim()) return;
    setCreating(true);
    try {
      const created = await createCollection({
        title: newTitle.trim(),
        isPublic: newIsPublic,
      });
      await addToCollection(created.id, wallpaperId);
      const next: CollectionCheck[] = [
        {
          id: created.id,
          title: created.title,
          isPublic: created.isPublic,
          hasWallpaper: true,
        },
        ...collections,
      ];
      setCollections(next);
      syncSavedId(next);
      setNewTitle("");
      setNewIsPublic(false);
      setShowCreate(false);
      toast(`Saved to "${created.title}"`);
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Failed to create collection",
        "error"
      );
    } finally {
      setCreating(false);
    }
  };

  const iconSize = size === "sm" ? 13 : 18;

  const dropdown =
    open && mounted
      ? createPortal(
          <>
            {/* invisible backdrop to close on outside click */}
            <div
              className="fixed inset-0 z-40"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleClose();
              }}
            />

            {/* dropdown panel */}
            <div
              className="fixed z-50 w-64 rounded-2xl p-4"
              style={{
                top: dropdownPos.top,
                ...(dropdownPos.alignRight
                  ? { right: dropdownPos.right }
                  : { left: dropdownPos.left }),
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                boxShadow: "0 16px 48px rgba(0,0,0,0.65)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* header */}
              <div className="flex items-center justify-between mb-3">
                <span
                  className="text-xs font-semibold tracking-widest uppercase"
                  style={{ color: "var(--text-muted)" }}
                >
                  Save to
                </span>
                <button
                  onClick={handleClose}
                  className="text-xs hover:opacity-60 transition-opacity"
                  style={{ color: "var(--text-muted)" }}
                >
                  ✕
                </button>
              </div>

              {/* collections list */}
              <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto mb-3">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-9 rounded-lg animate-pulse"
                      style={{ background: "var(--bg-primary)" }}
                    />
                  ))
                ) : collections.length === 0 && !showCreate ? (
                  <p
                    className="text-xs text-center py-3"
                    style={{ color: "var(--text-muted)" }}
                  >
                    No collections yet. Create one below.
                  </p>
                ) : (
                  collections.map((col) => (
                    <button
                      key={col.id}
                      onClick={() => handleToggle(col)}
                      disabled={saving === col.id}
                      className="flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/5 disabled:opacity-50"
                      style={{ border: "1px solid var(--border)" }}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors"
                          style={{
                            background: col.hasWallpaper
                              ? "var(--accent)"
                              : "transparent",
                            border: col.hasWallpaper
                              ? "none"
                              : "1px solid var(--border)",
                          }}
                        >
                          {col.hasWallpaper && (
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="var(--bg-primary)"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                        <span style={{ color: "var(--text-primary)" }}>
                          {col.title}
                        </span>
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
                <div
                  className="flex flex-col gap-2 pt-3"
                  style={{ borderTop: "1px solid var(--border)" }}
                >
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
                    onFocus={(e) =>
                      (e.target.style.borderColor = "var(--accent)")
                    }
                    onBlur={(e) =>
                      (e.target.style.borderColor = "var(--border)")
                    }
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  />

                  <button
                    onClick={() => setNewIsPublic((v) => !v)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors hover:bg-white/5"
                    style={{
                      border: "1px solid var(--border)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <div
                      className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                      style={{
                        background: newIsPublic
                          ? "var(--accent)"
                          : "transparent",
                        border: newIsPublic
                          ? "none"
                          : "1px solid var(--border)",
                      }}
                    >
                      {newIsPublic && (
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="var(--bg-primary)"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    Make public
                  </button>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowCreate(false);
                        setNewTitle("");
                      }}
                      className="flex-1 py-2 rounded-lg text-xs"
                      style={{
                        border: "1px solid var(--border)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreate}
                      disabled={creating || !newTitle.trim()}
                      className="flex-1 py-2 rounded-lg text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
                      style={{
                        background: "var(--accent)",
                        color: "var(--bg-primary)",
                      }}
                    >
                      {creating ? "Creating…" : "Create"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowCreate(true)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors hover:bg-white/5"
                  style={{
                    border: "1px dashed var(--border)",
                    color: "var(--text-muted)",
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  New collection
                </button>
              )}
            </div>
          </>,
          document.body
        )
      : null;

  if (variant === "card") {
    return (
      <>
        <button
          ref={buttonRef}
          onClick={handleClick}
          className="flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200"
          style={{
            background: isSaved
              ? "rgba(139,92,246,0.85)"
              : "rgba(0,0,0,0.5)",
            border: isSaved
              ? "1px solid rgba(139,92,246,0.4)"
              : "1px solid rgba(255,255,255,0.12)",
            backdropFilter: "blur(8px)",
            color: isSaved ? "white" : "rgba(255,255,255,0.85)",
          }}
          title="Save to collection"
        >
          <svg
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
            fill={isSaved ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </button>
        {dropdown}
      </>
    );
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleClick}
        className="flex items-center gap-2 transition-all duration-200 hover:opacity-70"
        style={{ color: isSaved ? "var(--accent)" : "var(--text-muted)" }}
        title="Save to collection"
      >
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill={isSaved ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      </button>
      {dropdown}
    </>
  );
};

export default BookmarkButton;
