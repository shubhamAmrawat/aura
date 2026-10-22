import AuroraWallpaper from "../../modules/aurora-wallpaper";
import { fetchPool } from "./engine";
import { loadState, saveState } from "./state";
import { getToken } from "../tokenStorage";

/**
 * Scheduling for the wallpaper changer. It runs fully native (modules/aurora-wallpaper/android:
 * ChangerScheduler / ChangerCore): an alarm that may fire while the phone is idle sets the next
 * wallpaper (downloaded in advance), then sets the following alarm one interval later.
 */

const requireNative = () => {
  if (!AuroraWallpaper) throw new Error("This version of the app can't change wallpapers in the background. Please update the app.");
  return AuroraWallpaper;
};

/** Start (or restart) the schedule: the next change is one interval from now. Returns its time (ms). */
export async function scheduleChanger(intervalHours: number): Promise<number> {
  return await requireNative().schedule(Math.round(intervalHours * 60));
}

export async function unscheduleChanger() {
  await AuroraWallpaper?.cancel();
}

/** Dev test: the scheduled change in about a minute, through the real alarm. */
export async function scheduleTestRunInOneMinute() {
  await requireNative().scheduleTestRun(60);
}

/**
 * On app start: refresh the cached wallpaper list (the native side can't call the API), and make
 * sure the next change is scheduled (e.g. after a reboot or update). Quiet on failure.
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
  await AuroraWallpaper?.ensureScheduled();
}

/** The changer is for signed-in users: turn it off (and stop the background job) when signed out. */
export async function stopChangerIfSignedOut(signedIn: boolean) {
  if (signedIn) return;
  // Still holding a token = signed in but the profile didn't load (offline / server busy): keep it on.
  if (await getToken()) return;
  const s = await loadState();
  if (!s.enabled) return;
  await unscheduleChanger();
  await saveState({ ...(await loadState()), enabled: false });
}
