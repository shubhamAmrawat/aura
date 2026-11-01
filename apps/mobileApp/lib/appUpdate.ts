import { Linking } from "react-native";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import AuroraNotify, { type UpdateState } from "../modules/aurora-notify";
import { request } from "./api";

/**
 * Updating the app from inside it. Installed from Play: Google Play's in-app update (downloads
 * in the background, then "Restart to finish"). Otherwise (e.g. a Firebase test build): a link
 * to the Play Store. Versions come from admin › Notifications (latest / minimum).
 */

export const PLAY_URL = "https://play.google.com/store/apps/details?id=com.shubhzx09.aurorawalls";
const PROMPT_KEY = "update_prompted_v1";
const PROMPT_GAP_MS = 24 * 3600_000;

export type UpdatePlan =
  | { kind: "none" }
  /** Play can update in place; `required` = older than the minimum version */
  | { kind: "play"; required: boolean; downloaded: boolean }
  /** not a Play install: send them to the Play Store */
  | { kind: "store"; required: boolean; latest: string };

export const currentVersion = () => Constants.expoConfig?.version ?? "0.0.0";

function compare(a: string, b: string) {
  const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
}

async function serverVersions(): Promise<{ latest: string | null; min: string | null }> {
  try {
    const res = await request<{ versions: { latest: string | null; min: string | null } }>("/api/app/config");
    return res.versions;
  } catch {
    return { latest: null, min: null };
  }
}

/** What to offer now (on launch). */
export async function checkForAppUpdate(): Promise<UpdatePlan> {
  const v = currentVersion();
  const { latest, min } = await serverVersions();
  const required = !!min && compare(v, min) < 0;
  const behind = !!latest && compare(v, latest) < 0;

  if (AuroraNotify?.isFromPlay()) {
    try {
      const info = await AuroraNotify.checkForUpdate();
      if (info.status === "downloaded") return { kind: "play", required, downloaded: true };
      if (info.available) return { kind: "play", required: required && info.immediate, downloaded: false };
    } catch {
      /* Play not reachable: fall through to the store link if we're behind */
    }
  }
  if (required || behind) return { kind: "store", required, latest: latest ?? min ?? "" };
  return { kind: "none" };
}

/** Don't nag: a suggested update is offered at most once a day (required ones always). */
export async function shouldPrompt(plan: UpdatePlan) {
  if (plan.kind === "none") return false;
  if (plan.required || (plan.kind === "play" && plan.downloaded)) return true;
  try {
    const last = Number((await SecureStore.getItemAsync(PROMPT_KEY)) ?? 0);
    return Date.now() - last > PROMPT_GAP_MS;
  } catch {
    return true;
  }
}

export async function notePrompted() {
  await SecureStore.setItemAsync(PROMPT_KEY, String(Date.now())).catch(() => undefined);
}

/** Starts Play's update (flexible = in the background; immediate = Play's full-screen update). */
export async function startAppUpdate(immediate = false): Promise<boolean> {
  if (AuroraNotify?.isFromPlay()) {
    try {
      return await AuroraNotify.startUpdate(immediate ? "immediate" : "flexible");
    } catch {
      /* fall back to the store page */
    }
  }
  await Linking.openURL(PLAY_URL).catch(() => undefined);
  return false;
}

export const completeAppUpdate = () => AuroraNotify?.completeUpdate();

export function onUpdateState(cb: (s: UpdateState) => void) {
  const sub = AuroraNotify?.addListener("onUpdateState", cb);
  return () => sub?.remove();
}

/** Opened from a notification's Update button. */
export const UPDATE_REQUESTED = "aurora:updateRequested";
