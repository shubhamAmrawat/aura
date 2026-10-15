import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";
import { WallpaperTile } from "./api";
import * as api from "./collectionsApi";
import type { Collection } from "./collectionsApi";

/**
 * One shared store for the signed-in user's collections, so every screen agrees:
 * Library, a collection's screen, the save sheet and the bookmark on the wallpaper screen.
 *
 * Writes update the store first (instant UI) and roll back if the request fails. A short,
 * debounced reload afterwards picks up what only the server knows (new covers, exact counts,
 * whether a wallpaper is still in another collection).
 *
 * State and actions live in two contexts: actions never change, so components that only
 * act (e.g. every grid card's long-press) don't re-render when the data changes. The save
 * sheet's target has its own context, read only by <SaveSheetHost /> (components/SaveSheet).
 */

type Status = "idle" | "loading" | "ready" | "error";

type CollectionsState = {
  collections: Collection[] | null;
  status: Status;
  /** Ids of wallpapers that are in at least one of the user's collections. */
  savedIds: Set<string>;
  /** Bumped whenever a collection's contents change; screens use it to know when to reload. */
  revisions: Record<string, number>;
};

type CollectionsActions = {
  refresh: () => Promise<void>;
  createCollection: (input: { title: string; isPublic: boolean; description?: string | null }) => Promise<Collection>;
  updateCollection: (id: string, patch: { title?: string; description?: string | null; isPublic?: boolean }) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  addToCollection: (collectionId: string, wallpaper: WallpaperTile) => Promise<void>;
  /** `savedElsewhere`: whether the wallpapers are still in another collection, when the caller knows. */
  removeFromCollection: (collectionId: string, wallpaperIds: string[], opts?: { savedElsewhere?: boolean }) => Promise<void>;
  /** Open the "Save to collection" sheet for a wallpaper (asks to sign in when signed out). */
  openSaveSheet: (wallpaper: WallpaperTile) => void;
};

type SaveSheetTarget = { wallpaper: WallpaperTile | null; close: () => void };

const StateContext = createContext<CollectionsState | null>(null);
const ActionsContext = createContext<CollectionsActions | null>(null);
const SaveSheetContext = createContext<SaveSheetTarget | null>(null);

const EMPTY = new Set<string>();
const RECONCILE_DELAY = 800;

export function CollectionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const userId = user?.id ?? null;

  const [collections, setCollections] = useState<Collection[] | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [savedIds, setSavedIds] = useState<Set<string>>(EMPTY);
  const [revisions, setRevisions] = useState<Record<string, number>>({});
  const [sheetWallpaper, setSheetWallpaper] = useState<WallpaperTile | null>(null);

  // Latest values for rollback snapshots inside async writes.
  const collectionsRef = useRef(collections);
  collectionsRef.current = collections;
  const savedIdsRef = useRef(savedIds);
  savedIdsRef.current = savedIds;

  // Requests from a previous account must never land in the current one.
  const generation = useRef(0);
  const pendingWrites = useRef(0);
  /** Counts writes started; a reload that overlapped a write is stale and dropped. */
  const writeSeq = useRef(0);
  const reconcileTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const gen = generation.current;
    const seq = writeSeq.current;
    const [list, ids] = await Promise.all([api.getMyCollections(), api.getSavedWallpaperIds()]);
    if (gen !== generation.current) return;
    // A write started while this was loading: keep its optimistic state (it schedules its own reload).
    if (seq !== writeSeq.current) return;
    setCollections(list);
    setSavedIds(new Set(ids));
    setStatus("ready");
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      await load();
    } catch {
      setStatus((s) => (s === "ready" ? s : "error"));
    }
  }, [userId, load]);

  useEffect(() => {
    generation.current++;
    if (reconcileTimer.current) clearTimeout(reconcileTimer.current);
    setCollections(null);
    setSavedIds(EMPTY);
    setRevisions({});
    setSheetWallpaper(null);
    if (!userId) {
      setStatus("idle");
      return;
    }
    setStatus("loading");
    void refresh();
  }, [userId, refresh]);

  useEffect(
    () => () => {
      if (reconcileTimer.current) clearTimeout(reconcileTimer.current);
    },
    []
  );

  /** Reload quietly once writes have settled (never while one is still in flight). */
  const scheduleReconcile = useCallback(() => {
    if (reconcileTimer.current) clearTimeout(reconcileTimer.current);
    reconcileTimer.current = setTimeout(function run() {
      if (pendingWrites.current > 0) {
        reconcileTimer.current = setTimeout(run, RECONCILE_DELAY);
        return;
      }
      reconcileTimer.current = null;
      load().catch(() => undefined);
    }, RECONCILE_DELAY);
  }, [load]);

  const write = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      pendingWrites.current++;
      writeSeq.current++;
      try {
        return await fn();
      } finally {
        pendingWrites.current--;
        scheduleReconcile();
      }
    },
    [scheduleReconcile]
  );

  const bump = (id: string) => setRevisions((r) => ({ ...r, [id]: (r[id] ?? 0) + 1 }));
  const patchOne = (id: string, fn: (c: Collection) => Collection) =>
    setCollections((cs) => cs?.map((c) => (c.id === id ? fn(c) : c)) ?? cs);

  const createCollection = useCallback<CollectionsActions["createCollection"]>(
    (input) =>
      write(async () => {
        const created = await api.createCollection(input);
        const row: Collection = { ...created, coverUrl: null, coverThumbUrl: null, wallpaperCount: 0 };
        setCollections((cs) => [row, ...(cs ?? [])]);
        return row;
      }),
    [write]
  );

  const updateCollection = useCallback<CollectionsActions["updateCollection"]>(
    (id, patch) =>
      write(async () => {
        const before = collectionsRef.current?.find((c) => c.id === id);
        const changes = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as Partial<Collection>;
        patchOne(id, (c) => ({ ...c, ...changes }));
        try {
          await api.updateCollection(id, patch);
          bump(id);
        } catch (e) {
          if (before) patchOne(id, () => before);
          throw e;
        }
      }),
    [write]
  );

  const deleteCollection = useCallback<CollectionsActions["deleteCollection"]>(
    (id) =>
      write(async () => {
        const snapshot = collectionsRef.current;
        setCollections((cs) => cs?.filter((c) => c.id !== id) ?? cs);
        try {
          await api.deleteCollection(id);
          bump(id);
        } catch (e) {
          setCollections(snapshot);
          throw e;
        }
      }),
    [write]
  );

  const addToCollection = useCallback<CollectionsActions["addToCollection"]>(
    (collectionId, w) =>
      write(async () => {
        const wasSaved = savedIdsRef.current.has(w.id);
        if (!wasSaved)
          setSavedIds((s) => {
            const n = new Set(s);
            n.add(w.id);
            return n;
          });
        patchOne(collectionId, (c) => ({
          ...c,
          wallpaperCount: c.wallpaperCount + 1,
          coverWallpaperId: c.coverWallpaperId ?? w.id,
          coverUrl: c.coverUrl ?? w.fileUrl,
          coverThumbUrl: c.coverWallpaperId ? c.coverThumbUrl : w.thumbUrl ?? null,
        }));
        try {
          await api.addToCollection(collectionId, w.id);
          bump(collectionId);
        } catch (e) {
          if (!wasSaved)
            setSavedIds((s) => {
              const n = new Set(s);
              n.delete(w.id);
              return n;
            });
          patchOne(collectionId, (c) => ({ ...c, wallpaperCount: Math.max(0, c.wallpaperCount - 1) }));
          throw e;
        }
      }),
    [write]
  );

  const removeFromCollection = useCallback<CollectionsActions["removeFromCollection"]>(
    (collectionId, ids, opts) =>
      write(async () => {
        if (opts?.savedElsewhere === false) {
          setSavedIds((s) => {
            const n = new Set(s);
            for (const id of ids) n.delete(id);
            return n;
          });
        }
        patchOne(collectionId, (c) => ({ ...c, wallpaperCount: Math.max(0, c.wallpaperCount - ids.length) }));
        const results = await Promise.allSettled(ids.map((id) => api.removeFromCollection(collectionId, id)));
        bump(collectionId);
        const failed = results.filter((r) => r.status === "rejected").length;
        if (failed) {
          // The reconcile reload restores exact counts and saved ids.
          throw new Error(failed === ids.length ? "Couldn't remove." : `Couldn't remove ${failed} of ${ids.length}.`);
        }
      }),
    [write]
  );

  const openSaveSheet = useCallback(
    (w: WallpaperTile) => {
      if (!userId) {
        showToast("Please login to save wallpapers.", { type: "info", position: "top" });
        return;
      }
      setSheetWallpaper(w);
    },
    [userId, showToast]
  );

  const state = useMemo(() => ({ collections, status, savedIds, revisions }), [collections, status, savedIds, revisions]);
  const actions = useMemo(
    () => ({ refresh, createCollection, updateCollection, deleteCollection, addToCollection, removeFromCollection, openSaveSheet }),
    [refresh, createCollection, updateCollection, deleteCollection, addToCollection, removeFromCollection, openSaveSheet]
  );

  const closeSheet = useCallback(() => setSheetWallpaper(null), []);
  const sheet = useMemo(() => ({ wallpaper: sheetWallpaper, close: closeSheet }), [sheetWallpaper, closeSheet]);

  return (
    <ActionsContext.Provider value={actions}>
      <StateContext.Provider value={state}>
        <SaveSheetContext.Provider value={sheet}>{children}</SaveSheetContext.Provider>
      </StateContext.Provider>
    </ActionsContext.Provider>
  );
}

export function useCollections() {
  const ctx = useContext(StateContext);
  if (!ctx) throw new Error("useCollections must be used inside CollectionsProvider");
  return ctx;
}

/** For <SaveSheetHost /> only: which wallpaper the save sheet is open for. */
export function useSaveSheetTarget() {
  const ctx = useContext(SaveSheetContext);
  if (!ctx) throw new Error("useSaveSheetTarget must be used inside CollectionsProvider");
  return ctx;
}

export function useCollectionActions() {
  const ctx = useContext(ActionsContext);
  if (!ctx) throw new Error("useCollectionActions must be used inside CollectionsProvider");
  return ctx;
}
