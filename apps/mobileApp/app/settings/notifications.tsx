import { useCallback, useEffect, useState } from "react";
import { AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as IntentLauncher from "expo-intent-launcher";
import Header from "../../components/Header";
import { Colors } from "../../constants";
import { useInsets } from "../../hooks/useInsets";
import { useAuth } from "../../lib/AuthContext";
import { useScreenFilter } from "../../lib/ScreenFilterContext";
import { useToast } from "../../lib/ToastContext";
import { DEFAULT_PREFS, getPrefs, permissionState, registerForPush, requestPermission, setPrefs, type NotificationPrefs } from "../../lib/notifications";

type Key = keyof NotificationPrefs;
const PACKAGE = Constants.expoConfig?.android?.package ?? "com.shubhzx09.aurorawalls";

/** This app's notification page in Android settings (where "pop-up" / "floating" lives on most phones). */
async function openNotificationSettings() {
  try {
    await IntentLauncher.startActivityAsync("android.settings.APP_NOTIFICATION_SETTINGS", {
      extra: { "android.provider.extra.APP_PACKAGE": PACKAGE },
    });
  } catch {
    void Linking.openSettings();
  }
}

const GROUPS: { title: string; rows: { key: Key; label: string; sub: string; pops: boolean; signedIn?: boolean }[] }[] = [
  {
    title: "From Aurora",
    rows: [
      { key: "drops", label: "New drops", sub: "When a limited drop goes live", pops: true },
      { key: "daily", label: "Wallpaper of the day", sub: "Every morning at 9:00", pops: false },
      { key: "updates", label: "App updates and announcements", sub: "New versions and news from Aurora", pops: true },
    ],
  },
  {
    title: "About you",
    rows: [
      { key: "uploads", label: "Your uploads", sub: "Approved or needs changes", pops: true, signedIn: true },
      { key: "milestones", label: "Milestones", sub: "When your wallpapers reach new likes", pops: false, signedIn: true },
      { key: "account", label: "Account and reports", sub: "Creator application, reports you made", pops: true, signedIn: true },
    ],
  },
];

/** Settings › Notifications: Android permission state + a switch per type (saved for this phone). */
export default function NotificationSettings() {
  const { user } = useAuth();
  const { screen } = useScreenFilter();
  const { showToast } = useToast();
  const { bottomPadding } = useInsets();
  const [permission, setPermission] = useState<"granted" | "denied" | "undetermined" | null>(null);
  const [prefs, setLocal] = useState<NotificationPrefs>(DEFAULT_PREFS);

  const load = useCallback(async () => {
    const p = await permissionState();
    setPermission(p);
    if (p === "granted") {
      await registerForPush(screen).catch(() => undefined);
      const r = await getPrefs().catch(() => null);
      if (r) setLocal(r.prefs);
    }
  }, [screen]);

  useEffect(() => {
    void load();
    const sub = AppState.addEventListener("change", (s) => s === "active" && void load()); // back from Android settings
    return () => sub.remove();
  }, [load]);

  const enable = async () => {
    if (permission === "denied") {
      void Linking.openSettings();
      return;
    }
    if (await requestPermission().catch(() => false)) await load();
  };

  const toggle = async (key: Key, value: boolean) => {
    const before = prefs;
    setLocal({ ...prefs, [key]: value });
    try {
      const r = await setPrefs({ [key]: value });
      setLocal(r.prefs);
    } catch {
      setLocal(before);
      showToast("Couldn't save. Check your connection.", { type: "error", position: "top" });
    }
  };

  const on = permission === "granted";

  return (
    <View style={styles.container}>
      <Header title="Notifications" logo={false} titleFontSize={20} showBackButton />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + 32 }]}>
        {permission !== null ? (
          on ? (
            <View style={[styles.state, styles.stateOn]}>
              <Ionicons name="checkmark" size={20} color={Colors.accent} />
              <Text style={styles.stateText}>Notifications are on for this phone</Text>
            </View>
          ) : (
            <View style={[styles.state, styles.stateOff]}>
              <Ionicons name="notifications-off-outline" size={20} color="#FFB66B" />
              <Text style={styles.stateText}>{permission === "denied" ? "Notifications are off in Android settings" : "Notifications are off"}</Text>
              <Pressable onPress={() => void enable()} style={styles.stateBtn} accessibilityRole="button">
                <Text style={styles.stateBtnText}>{permission === "denied" ? "Open settings" : "Turn on"}</Text>
              </Pressable>
            </View>
          )
        ) : null}

        {on && Platform.OS === "android" ? (
          <View style={styles.hint}>
            <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
              <View style={styles.hintIcon}>
                <Ionicons name="phone-portrait-outline" size={18} color="#93C5FD" />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.hintTitle}>Not popping up on screen?</Text>
                <Text style={styles.hintText}>
                  Some phones (Xiaomi, Oppo, Vivo, Realme) turn off “floating” or “pop-up” notifications for new apps. Turn it on for Aurora to see drops the moment they land.
                </Text>
              </View>
            </View>
            <Pressable onPress={() => void openNotificationSettings()} style={styles.hintBtn} accessibilityRole="button">
              <Text style={styles.hintBtnText}>Open Android settings</Text>
            </Pressable>
          </View>
        ) : null}

        {GROUPS.map((g) => (
          <View key={g.title} style={{ gap: 8 }}>
            <Text style={styles.groupTitle}>{g.title.toUpperCase()}</Text>
            <View style={styles.group}>
              {g.rows.map((r, i) => {
                const disabled = !on || (r.signedIn && !user);
                return (
                  <View key={r.key} style={[styles.row, i > 0 && styles.divider, disabled && { opacity: 0.45 }]}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.rowLabel}>{r.label}</Text>
                      <Text style={styles.rowSub}>{r.sub}</Text>
                    </View>
                    {on ? (
                      <View style={[styles.pop, r.pops ? styles.popOn : styles.popOff]}>
                        <Text style={[styles.popText, { color: r.pops ? Colors.accent : "#A9A59F" }]}>{r.pops ? "Pops up" : "Quiet"}</Text>
                      </View>
                    ) : null}
                    <Switch
                      value={on && prefs[r.key]}
                      disabled={disabled}
                      onValueChange={(v) => void toggle(r.key, v)}
                      trackColor={{ false: "rgba(255,255,255,0.16)", true: Colors.accent }}
                      thumbColor={on && prefs[r.key] ? "#0A0A0A" : "#DDD9D3"}
                      accessibilityLabel={r.label}
                    />
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        {!user ? <Text style={styles.note}>Sign in to get notifications about your uploads, creator application and reports.</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  content: { padding: 16, gap: 22 },
  state: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 18, borderWidth: 1 },
  stateOn: { backgroundColor: "rgba(129,238,78,0.08)", borderColor: "rgba(129,238,78,0.25)" },
  stateOff: { backgroundColor: "rgba(255,154,60,0.08)", borderColor: "rgba(255,154,60,0.3)" },
  stateText: { flex: 1, color: "#DDD9D3", fontSize: 13.5 },
  stateBtn: { height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center" },
  stateBtnText: { color: "#0A0A0A", fontSize: 13, fontWeight: "800" },
  groupTitle: { color: Colors.textMuted, fontSize: 12, fontWeight: "700", letterSpacing: 1.2, marginHorizontal: 4 },
  group: { borderRadius: 18, backgroundColor: "#0E0E0E", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.08)" },
  rowLabel: { color: Colors.textPrimary, fontSize: 14.5, fontWeight: "600" },
  rowSub: { color: Colors.textMuted, fontSize: 12.5 },
  hint: { padding: 14, gap: 10, borderRadius: 18, backgroundColor: "#121212", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  hintIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(147,197,253,0.12)", alignItems: "center", justifyContent: "center" },
  hintTitle: { color: Colors.textPrimary, fontSize: 14.5, fontWeight: "700" },
  hintText: { color: "#A9A59F", fontSize: 12.5, lineHeight: 18 },
  hintBtn: { height: 40, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  hintBtnText: { color: Colors.textPrimary, fontSize: 13.5, fontWeight: "700" },
  pop: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  popOn: { backgroundColor: "rgba(129,238,78,0.12)" },
  popOff: { backgroundColor: "rgba(255,255,255,0.06)" },
  popText: { fontSize: 11, fontWeight: "700" },
  note: { color: Colors.textMuted, fontSize: 12, lineHeight: 18, marginHorizontal: 4 },
});
