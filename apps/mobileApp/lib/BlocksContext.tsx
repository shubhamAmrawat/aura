import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { saveBlockedIds } from "./blockedStore";
import { BlockedCreator, blockCreator, getBlockedCreators, unblockCreator } from "./moderationApi";

type BlocksValue = {
  /** null until loaded (signed out = empty list) */
  blocked: BlockedCreator[] | null;
  blockedIds: Set<string>;
  block: (creator: BlockedCreator) => Promise<void>;
  unblock: (creatorId: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const BlocksContext = createContext<BlocksValue | null>(null);
const EMPTY = new Set<string>();

/**
 * Creators the signed-in user blocked. Feeds are shared by everyone (and cached), so their
 * wallpapers are hidden here on the device: grids filter with `useVisibleWallpapers`.
 */
export function BlocksProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [blocked, setBlocked] = useState<BlockedCreator[] | null>(null);
  const generation = useRef(0);

  const apply = useCallback((list: BlockedCreator[]) => {
    setBlocked(list);
    saveBlockedIds(list.map((b) => b.id));
  }, []);

  const refresh = useCallback(async () => {
    const gen = generation.current;
    try {
      const list = await getBlockedCreators();
      if (gen === generation.current) apply(list);
    } catch {
      // keep what we have; the next launch or sign-in retries
    }
  }, [apply]);

  useEffect(() => {
    generation.current++;
    if (!userId) {
      apply([]);
      return;
    }
    setBlocked(null);
    void refresh();
  }, [userId, apply, refresh]);

  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;

  const block = useCallback(
    async (creator: BlockedCreator) => {
      const before = blockedRef.current ?? [];
      if (before.some((b) => b.id === creator.id)) return;
      apply([{ ...creator, blockedAt: new Date().toISOString() }, ...before]);
      try {
        await blockCreator(creator.id);
      } catch (e) {
        apply(before);
        throw e;
      }
    },
    [apply]
  );

  const unblock = useCallback(
    async (creatorId: string) => {
      const before = blockedRef.current ?? [];
      apply(before.filter((b) => b.id !== creatorId));
      try {
        await unblockCreator(creatorId);
      } catch (e) {
        apply(before);
        throw e;
      }
    },
    [apply]
  );

  const blockedIds = useMemo(() => (blocked && blocked.length ? new Set(blocked.map((b) => b.id)) : EMPTY), [blocked]);
  const value = useMemo(() => ({ blocked, blockedIds, block, unblock, refresh }), [blocked, blockedIds, block, unblock, refresh]);
  return <BlocksContext.Provider value={value}>{children}</BlocksContext.Provider>;
}

export function useBlocks() {
  const ctx = useContext(BlocksContext);
  if (!ctx) throw new Error("useBlocks must be used inside BlocksProvider");
  return ctx;
}

/** The list without wallpapers from blocked creators (same array when nothing is hidden). */
export function useVisibleWallpapers<T extends { creatorId?: string | null }>(items: T[]): T[] {
  const { blockedIds } = useBlocks();
  return useMemo(
    () => (blockedIds.size === 0 ? items : items.filter((w) => !w.creatorId || !blockedIds.has(w.creatorId))),
    [items, blockedIds]
  );
}
