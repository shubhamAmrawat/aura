import { File, Paths } from "expo-file-system";

/**
 * Wallpaper changer settings + progress, kept in a small JSON file in the app's documents
 * folder so the background task (which runs without any screen) can read and update it.
 */

export type ChangerTarget = "home" | "lock" | "both";

export type ChangerSource =
  | { kind: "liked"; name: string }
  | { kind: "collection"; id: string; name: string }
  | { kind: "category"; slug: string; name: string };

export type PoolItem = { id: string; fileUrl: string; title: string };

export type ChangerState = {
  enabled: boolean;
  source: ChangerSource | null;
  intervalHours: number;
  target: ChangerTarget;
  /** "mobile" on phones, "tablet" on tablets: which wallpaper shape to use. */
  screen: "mobile" | "tablet";
  /** Wallpapers in the source (cached so a failed fetch doesn't stop a change). */
  pool: PoolItem[];
  /** Shuffled ids still to show in this round; refilled when empty. */
  queue: string[];
  lastChangedAt: number | null;
  lastWallpaperId: string | null;
  lastError: string | null;
  lastErrorAt: number | null;
};

export const MIN_HOURS = 2;
export const MAX_HOURS = 24;

/**
 * TESTING: offers "Every 15 min" (Android's shortest repeat) so the changer can be checked on
 * several phones in the built APK. Set to false before a public release.
 */
export const SHOW_15_MIN_OPTION = true;
export const TEST_INTERVAL_HOURS = 0.25;

/** Quick picks shown on the changer screen (in hours). */
export const PRESET_HOURS: readonly number[] = SHOW_15_MIN_OPTION ? [TEST_INTERVAL_HOURS, 6, 12, 24] : [6, 12, 24];

/** "Every 15 min", "Every 6 h", "Daily". */
export const intervalLabel = (h: number) => (h < 1 ? `Every ${Math.round(h * 60)} min` : h === 24 ? "Daily" : `Every ${h} h`);

export const DEFAULT_STATE: ChangerState = {
  enabled: false,
  source: null,
  intervalHours: 12,
  target: "both",
  screen: "mobile",
  pool: [],
  queue: [],
  lastChangedAt: null,
  lastWallpaperId: null,
  lastError: null,
  lastErrorAt: null,
};

const file = () => new File(Paths.document, "wallpaper-changer.json");

export async function loadState(): Promise<ChangerState> {
  try {
    const f = file();
    if (!f.exists) return { ...DEFAULT_STATE };
    return { ...DEFAULT_STATE, ...(JSON.parse(await f.text()) as Partial<ChangerState>) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export async function saveState(state: ChangerState): Promise<void> {
  const f = file();
  if (!f.exists) f.create();
  f.write(JSON.stringify(state));
}

export async function updateState(patch: Partial<ChangerState>): Promise<ChangerState> {
  const next = { ...(await loadState()), ...patch };
  await saveState(next);
  return next;
}

export const clampHours = (h: number) => Math.min(MAX_HOURS, Math.max(MIN_HOURS, Math.round(h)));
