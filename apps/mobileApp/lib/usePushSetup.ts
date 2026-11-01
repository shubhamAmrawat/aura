import { useEffect } from "react";
import { Linking } from "react-native";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { configureNotifications, registerForPush, reportOpened } from "./notifications";
import type { ScreenFilter } from "./wallpaperApi";

/** Where a notification url goes in the app (used if expo-notifications drew the notification). */
export function openNotificationUrl(url: string | null | undefined) {
  if (!url) return router.push("/notifications");
  if (url.startsWith("https://") || url.startsWith("aurora://")) return void Linking.openURL(url).catch(() => undefined);
  if (url.startsWith("/")) return router.push(url as never);
  return router.push("/notifications");
}

/**
 * On launch and whenever the account changes: channels set up, and this phone's push token
 * (re)linked to the signed-in user (or unlinked after sign-out). Also handles taps on
 * notifications drawn by expo-notifications (Aurora's own are deep links, see +native-intent).
 */
export function usePushSetup(loaded: boolean, userId: string | null, screen: ScreenFilter) {
  useEffect(() => {
    void configureNotifications();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    void registerForPush(screen).catch((e) => console.warn("[notifications] register failed", e));
  }, [loaded, userId, screen]);

  useEffect(() => {
    const handle = (r: Notifications.NotificationResponse | null) => {
      if (!r) return;
      const data = r.notification.request.content.data as { url?: string | null; actions?: Record<string, string>; did?: string } | undefined;
      const action = r.actionIdentifier;
      const isButton = !!action && action !== Notifications.DEFAULT_ACTION_IDENTIFIER;
      const target = isButton ? data?.actions?.[action] : data?.url;
      if (data?.did) void reportOpened(data.did, isButton ? action : "tap");
      openNotificationUrl(target ?? null);
      void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
    };
    void Notifications.getLastNotificationResponseAsync().then(handle).catch(() => undefined);
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, []);
}
