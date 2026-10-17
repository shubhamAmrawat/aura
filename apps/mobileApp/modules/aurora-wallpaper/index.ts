import { requireOptionalNativeModule } from "expo-modules-core";

export type WallpaperTarget = "home" | "lock" | "both";

type AuroraWallpaperNative = {
  /** Sets the wallpaper from a local file (centre-cropped to the screen). Works without an open screen. */
  setFromFile(uri: string, target: WallpaperTarget): Promise<boolean>;
  /** Native background changer: runs about every `intervalMinutes` (min 15), first run after one interval. */
  schedule(intervalMinutes: number): Promise<boolean>;
  cancel(): Promise<boolean>;
  /** Dev test: one background change in `delaySeconds`, using the same native job. */
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
