import { requireOptionalNativeModule } from "expo-modules-core";

export type WallpaperTarget = "home" | "lock" | "both";

type AuroraWallpaperNative = {
  /** Sets the wallpaper from a local file (centre-cropped to the screen). Works without an open screen. */
  setFromFile(uri: string, target: WallpaperTarget): Promise<boolean>;
  /** Turn the changer on / apply a new interval (min 15): next change one interval from now. Resolves to its time (ms). */
  schedule(intervalMinutes: number): Promise<number>;
  /** Stop scheduled changes. */
  cancel(): Promise<boolean>;
  /** Set the next wallpaper in the round now (restarts the timer when the changer is on). */
  changeNow(): Promise<{ ok: boolean; title: string; error: string }>;
  /** On app start: make sure the next change is scheduled (alarms don't survive a reboot). */
  ensureScheduled(): Promise<boolean>;
  /** Dev test: the scheduled change, through the real alarm, in `delaySeconds`. */
  scheduleTestRun(delaySeconds: number): Promise<boolean>;
  /** True when the app is exempt from battery optimisation (background work isn't held back). */
  isIgnoringBatteryOptimizations(): boolean;
};

/**
 * Android-only native module (this folder's android/ code). Null until the app is rebuilt with
 * it (npx expo prebuild --clean / a new EAS build), so callers must handle that.
 */
const AuroraWallpaper = requireOptionalNativeModule<AuroraWallpaperNative>("AuroraWallpaper");

export default AuroraWallpaper;
