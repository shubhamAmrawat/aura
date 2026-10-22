import AuroraWallpaper from "../../modules/aurora-wallpaper";
import { WallpaperTile } from "../api";
import { getCollection } from "../collectionsApi";
import { Sentry } from "../sentry";
import { getLikedWallpapers, getWallpapers } from "../wallpaperApi";
import { ChangerSource, ChangerState, loadState, PoolItem, saveState } from "./state";
import { loadBlockedIds } from "../blockedStore";

/** Pages of a category to pool (100 per page). */
const CATEGORY_PAGES = 2;

const fitsScreen = (w: Pick<WallpaperTile, "width" | "height">, screen: ChangerState["screen"]) => {
  if (!w.width || !w.height) return true;
  return screen === "mobile" ? w.height >= w.width : w.width > w.height;
};

const toPool = (items: WallpaperTile[], screen: ChangerState["screen"], blocked: Set<string> = new Set()): PoolItem[] =>
  items
    .filter((w) => w.fileUrl && fitsScreen(w, screen) && !(w.creatorId && blocked.has(w.creatorId)))
    .map((w) => ({ id: w.id, fileUrl: w.fileUrl, title: w.title ?? "", thumbUrl: w.thumbUrl ?? null }));

/** The source's current wallpapers from the API (phone-shaped on phones). Throws on network/auth errors. */
export async function fetchPool(source: ChangerSource, screen: ChangerState["screen"]): Promise<PoolItem[]> {
  if (source.kind === "liked") return toPool(await getLikedWallpapers(), screen);
  if (source.kind === "collection") return toPool((await getCollection(source.id)).wallpapers, screen);
  // A category can include creators the user blocked: skip their wallpapers.
  const blocked = new Set(await loadBlockedIds());
  const items: WallpaperTile[] = [];
  for (let page = 0; page < CATEGORY_PAGES; page++) {
    const res = await getWallpapers({ category: source.slug, screen, limit: 100, offset: page * 100 });
    items.push(...res.data);
    if (!res.hasMore) break;
  }
  return toPool(items, screen, blocked);
}

export type ChangeResult = { ok: true; title: string } | { ok: false; error: string };

/**
 * "Shuffle now" (and the first change after turning on): refresh the source's list, then the
 * native side sets the next wallpaper in the round, records it and, when the changer is on,
 * restarts the timer. Scheduled changes run natively without the app (ChangerScheduler).
 */
export async function runChange(): Promise<ChangeResult> {
  const state = await loadState();
  if (!state.source) return { ok: false, error: "Choose where wallpapers come from first." };
  if (!AuroraWallpaper) return { ok: false, error: "This version of the app can't change wallpapers. Please update the app." };

  // Refresh the source; if that fails (offline, signed out), keep using the saved list.
  try {
    const pool = await fetchPool(state.source, state.screen);
    if (pool.length > 0) await saveState({ ...(await loadState()), pool });
  } catch {
    // keep the saved list
  }

  try {
    const res = await AuroraWallpaper.changeNow();
    return res.ok ? { ok: true, title: res.title } : { ok: false, error: res.error || "Couldn't change the wallpaper." };
  } catch (e) {
    Sentry.captureException(e, { tags: { feature: "wallpaper-changer" } });
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't change the wallpaper." };
  }
}
