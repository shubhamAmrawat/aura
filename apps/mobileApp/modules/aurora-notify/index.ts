import { requireOptionalNativeModule, type EventSubscription } from "expo-modules-core";

export type UpdateStatus = "pending" | "downloading" | "downloaded" | "installing" | "installed" | "failed" | "canceled" | "unknown";

export type UpdateInfo = {
  available: boolean;
  inProgress: boolean;
  flexible: boolean;
  immediate: boolean;
  versionCode: number;
  stalenessDays: number;
  status: UpdateStatus;
};

export type UpdateState = { status: UpdateStatus; bytesDownloaded: number; totalBytes: number };

type AuroraNotifyNative = {
  /** Remove a notification drawn natively (its id is the `_n` param of the deep link). */
  cancelNotification(id: number): void;
  /** Installed from Google Play (only then can Play update it in place). */
  isFromPlay(): boolean;
  checkForUpdate(): Promise<UpdateInfo>;
  /** Play's update UI; resolves true if the user accepted. */
  startUpdate(type: "flexible" | "immediate"): Promise<boolean>;
  /** After a flexible update finished downloading: restart into it. */
  completeUpdate(): Promise<boolean>;
  addListener(event: "onUpdateState", listener: (state: UpdateState) => void): EventSubscription;
};

/**
 * Android-only native module (this folder's android/ code): rich push notifications and Play
 * in-app updates. Null until the app is rebuilt with it, so callers must handle that.
 */
const AuroraNotify = requireOptionalNativeModule<AuroraNotifyNative>("AuroraNotify");

export default AuroraNotify;
