import { useCallback, useEffect, useState } from "react";
import { AppState, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Header from "../../components/Header";
import { Colors } from "../../constants";
import { useInsets } from "../../hooks/useInsets";
import { useAuth } from "../../lib/AuthContext";
import { useScreenFilter } from "../../lib/ScreenFilterContext";
import { useToast } from "../../lib/ToastContext";
import { DEFAULT_PREFS, getPrefs, permissionState, registerForPush, requestPermission, setPrefs, type NotificationPrefs } from "../../lib/notifications";

type Key = keyof NotificationPrefs;
const GROUPS: { title: string; rows: { key: Key; label: string; sub: string; signedIn?: boolean }[] }[] = [
  {
    title: "From Aurora",
    rows: [
      { key: "drops", label: "New drops", sub: "When a limited drop goes live" },
      { key: "daily", label: "Wallpaper of the day", sub: "Every morning at 9:00" },
      { key: "updates", label: "App updates and news", sub: "When a new version is ready" },
    ],
  },
  {
    title: "About you",
    rows: [
      { key: "uploads", label: "Your uploads", sub: "Approved or needs changes", signedIn: true },
      { key: "milestones", label: "Milestones", sub: "When your wallpapers reach new likes", signedIn: true },
      { key: "account", label: "Account and reports", sub: "Creator application, reports you made", signedIn: true },
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
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.08)" },
  rowLabel: { color: Colors.textPrimary, fontSize: 14.5, fontWeight: "600" },
  rowSub: { color: Colors.textMuted, fontSize: 12.5 },
  note: { color: Colors.textMuted, fontSize: 12, lineHeight: 18, marginHorizontal: 4 },
});
