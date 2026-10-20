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
import { BookmarkIcon, CheckIcon, PlusIcon } from "lucide-react";

interface BookmarkButtonProps {
  wallpaperId: string;
  size?: "sm" | "md";
  variant?: "card" | "detail";
  className?: string;
  onDropdownChange?: (open: boolean) => void;
}

interface DropdownPos {
  top: number;
  left: number;
  right: number;
  alignRight: boolean;
  /** open above the button (not enough room below it) */
  up: boolean;
  /** distance from the bottom of the screen when opening upwards */
  bottom: number;
  maxHeight: number;
}

const BookmarkButton = ({
  wallpaperId,
  size = "md",
  variant = "detail",
  className = "",
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
    up: false,
    bottom: 0,
    maxHeight: 400,
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
    const below = window.innerHeight - rect.bottom - 16;
    const above = rect.top - 16;
    // The panel is ~320px tall: open upwards when it would not fit underneath (e.g. a bar pinned to the bottom).
    const up = below < 320 && above > below;
    setDropdownPos({
      top: rect.bottom + 8,
      left: rect.left,
      right: window.innerWidth - rect.right,
      alignRight: window.innerWidth - rect.left < 264,
      up,
      bottom: window.innerHeight - rect.top + 8,
      maxHeight: Math.max(200, (up ? above : below) - 8),
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
              className="fixed z-50 w-64 rounded-2xl p-4 overflow-y-auto"
              style={{
                ...(dropdownPos.up ? { bottom: dropdownPos.bottom } : { top: dropdownPos.top }),
                maxHeight: dropdownPos.maxHeight,
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
                            <CheckIcon size={10} strokeWidth={3} stroke="var(--bg-primary)" aria-hidden="true" />
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
                    maxLength={60}
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
                        <CheckIcon size={10} strokeWidth={3} stroke="var(--bg-primary)" aria-hidden="true" />
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
                  <PlusIcon size={14} strokeWidth={2} aria-hidden="true" />
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
          <BookmarkIcon size={iconSize} strokeWidth={2.2} fill={isSaved ? "currentColor" : "none"} aria-hidden="true" />
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
        className={`flex items-center gap-2 rounded-full px-2 py-1.5 transition-colors duration-200 ${isSaved ? "" : "hover:bg-white/[0.08]"} ${className}`}
        style={isSaved
          ? { color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)", background: "color-mix(in srgb, var(--accent) 12%, transparent)" }
          : { color: "var(--text-primary)", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)" }}
        title={isSaved ? "Saved — change collections" : "Save to collection"}
        aria-label={isSaved ? "Saved — change collections" : "Save to collection"}
      >
        <BookmarkIcon size={iconSize - 1} strokeWidth={1.8} fill={isSaved ? "currentColor" : "none"} aria-hidden="true" />
      </button>
      {dropdown}
    </>
  );
};

export default BookmarkButton;
