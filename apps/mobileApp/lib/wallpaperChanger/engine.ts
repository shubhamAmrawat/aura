import { File, Paths } from "expo-file-system";
import AuroraWallpaper from "../../modules/aurora-wallpaper";
import { WallpaperTile } from "../api";
import { getCollection } from "../collectionsApi";
import { Sentry } from "../sentry";
import { getLikedWallpapers, getWallpapers } from "../wallpaperApi";
import { ChangerSource, ChangerState, loadState, PoolItem, saveState } from "./state";

/** Pages of a category to pool (100 per page). */
const CATEGORY_PAGES = 2;

const fitsScreen = (w: Pick<WallpaperTile, "width" | "height">, screen: ChangerState["screen"]) => {
  if (!w.width || !w.height) return true;
  return screen === "mobile" ? w.height >= w.width : w.width > w.height;
};

const toPool = (items: WallpaperTile[], screen: ChangerState["screen"]): PoolItem[] =>
  items.filter((w) => w.fileUrl && fitsScreen(w, screen)).map((w) => ({ id: w.id, fileUrl: w.fileUrl, title: w.title ?? "" }));

/** The source's current wallpapers from the API (phone-shaped on phones). Throws on network/auth errors. */
export async function fetchPool(source: ChangerSource, screen: ChangerState["screen"]): Promise<PoolItem[]> {
  if (source.kind === "liked") return toPool(await getLikedWallpapers(), screen);
  if (source.kind === "collection") return toPool((await getCollection(source.id)).wallpapers, screen);
  const items: WallpaperTile[] = [];
  for (let page = 0; page < CATEGORY_PAGES; page++) {
    const res = await getWallpapers({ category: source.slug, screen, limit: 100, offset: page * 100 });
    items.push(...res.data);
    if (!res.hasMore) break;
  }
  return toPool(items, screen);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Next wallpaper: walk a shuffled round, no repeats until every one has been shown. */
function pickNext(state: ChangerState): { item: PoolItem; queue: string[] } | null {
  const byId = new Map(state.pool.map((p) => [p.id, p]));
  let queue = state.queue.filter((id) => byId.has(id));
  if (queue.length === 0) {
    queue = shuffle([...byId.keys()]);
    // don't start the new round with the wallpaper that's on screen now
    if (queue.length > 1 && queue[0] === state.lastWallpaperId) queue.push(queue.shift()!);
  }
  const id = queue.shift();
  const item = id ? byId.get(id) : undefined;
  return item ? { item, queue } : null;
}

async function download(url: string): Promise<File> {
  const dest = new File(Paths.cache, `changer_${Date.now()}.img`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  dest.write(new Uint8Array(await res.arrayBuffer()));
  return dest;
}

export type ChangeResult = { ok: true; title: string } | { ok: false; error: string; skipped?: boolean };

/**
 * Sets the next wallpaper from the chosen source. Used by "Change now" and the background task.
 * `scheduled`: a background run, which is skipped when the last change was less than half an
 * interval ago (e.g. right after "Change now").
 */
export async function runChange(opts: { scheduled?: boolean } = {}): Promise<ChangeResult> {
  let state = await loadState();
  if (!state.source) return { ok: false, error: "Choose where wallpapers come from first.", skipped: true };
  if (opts.scheduled) {
    if (!state.enabled) return { ok: false, error: "The wallpaper changer is off.", skipped: true };
    const halfInterval = (state.intervalHours * 3600 * 1000) / 2;
    if (state.lastChangedAt && Date.now() - state.lastChangedAt < halfInterval) {
      return { ok: false, error: "Changed recently.", skipped: true };
    }
  }

  // Refresh the source; if that fails (offline, signed out), keep using the saved list.
  try {
    const pool = await fetchPool(state.source, state.screen);
    state = { ...state, pool };
  } catch {
    // keep state.pool
  }

  const fail = async (error: string): Promise<ChangeResult> => {
    await saveState({ ...state, lastError: error, lastErrorAt: Date.now() });
    return { ok: false, error };
  };

  if (state.pool.length === 0) return fail(`No ${state.screen === "mobile" ? "phone " : ""}wallpapers in “${state.source?.name ?? "this source"}”.`);
  const next = pickNext(state);
  if (!next) return fail("Couldn't pick a wallpaper.");

  let tmp: File | null = null;
  try {
    if (!AuroraWallpaper) throw new Error("This version of the app can't change wallpapers in the background. Please update the app.");
    tmp = await download(next.item.fileUrl);
    await AuroraWallpaper.setFromFile(tmp.uri, state.target);
    await saveState({
      ...state,
      queue: next.queue,
      lastChangedAt: Date.now(),
      lastWallpaperId: next.item.id,
      lastError: null,
      lastErrorAt: null,
    });
    return { ok: true, title: next.item.title };
  } catch (e) {
    Sentry.captureException(e, { tags: { feature: "wallpaper-changer", scheduled: String(!!opts.scheduled) } });
    return fail(e instanceof Error ? e.message : "Couldn't change the wallpaper.");
  } finally {
    try {
      tmp?.delete();
    } catch {
      // cache files are cleaned up by the system anyway
    }
  }
}
