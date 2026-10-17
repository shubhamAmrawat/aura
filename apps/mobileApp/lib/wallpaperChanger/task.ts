import AuroraWallpaper from "../../modules/aurora-wallpaper";
import { fetchPool } from "./engine";
import { loadState, saveState } from "./state";

/**
 * Scheduling for the wallpaper changer. The background job itself is native
 * (modules/aurora-wallpaper/android/.../ChangerWorker.kt) so no JavaScript has to run in the
 * background: Android (WorkManager) starts it about every `intervalHours`, with network.
 */

const requireNative = () => {
  if (!AuroraWallpaper) throw new Error("This version of the app can't change wallpapers in the background. Please update the app.");
  return AuroraWallpaper;
};

/** Start (or restart) the schedule. The first background change comes after one interval. */
export async function scheduleChanger(intervalHours: number) {
  await requireNative().schedule(Math.round(intervalHours * 60));
}

export async function unscheduleChanger() {
  await AuroraWallpaper?.cancel();
}

/** Dev test: one background change in about a minute, through the same native job. */
export async function scheduleTestRunInOneMinute() {
  await requireNative().scheduleTestRun(60);
}

/**
 * On app start: refresh the cached wallpaper list (the native job can't call the API), and make
 * sure the schedule exists (e.g. after an app update). Quiet on failure.
 */
export async function syncChangerOnLaunch() {
  const s = await loadState();
  if (!s.enabled || !s.source) return;
  try {
    const pool = await fetchPool(s.source, s.screen);
    if (pool.length > 0) await saveState({ ...(await loadState()), pool });
  } catch {
    // offline or signed out: keep the saved list
  }
}
