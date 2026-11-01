import { useEffect, useRef, useState } from "react";
import { DeviceEventEmitter, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import Sheet from "./Sheet";
import { Colors } from "../constants";
import { ASK_NOTIFICATIONS } from "../lib/notificationEvents";
import { noteAsked, registerForPush, requestPermission, shouldAskForPermission } from "../lib/notifications";
import { useScreenFilter } from "../lib/ScreenFilterContext";

const SERIF = "InstrumentSerif";

const POINTS: { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; strong: string; rest: string }[] = [
  { icon: "sparkles-outline", color: "#FFB66B", bg: "rgba(255,154,60,0.14)", strong: "New drops", rest: " the moment they go live" },
  { icon: "sunny-outline", color: Colors.accent, bg: "rgba(129,238,78,0.12)", strong: "Wallpaper of the day", rest: ", set it in one tap" },
  { icon: "cloud-upload-outline", color: "#93C5FD", bg: "rgba(147,197,253,0.12)", strong: "Your uploads", rest: " when they're approved" },
];

/**
 * Our own explainer before Android's permission prompt, shown at a good moment (after a first
 * download, apply or save), at most 3 times a week apart. "Turn on" → Android's prompt.
 */
export default function NotificationPromptHost() {
  const [fontsLoaded] = useFonts({ [SERIF]: require("../assets/fonts/InstrumentSerif-Regular.ttf") });
  const serif = fontsLoaded ? { fontFamily: SERIF, fontWeight: "400" as const } : { fontWeight: "700" as const };
  const { screen } = useScreenFilter();
  const [visible, setVisible] = useState(false);
  const pending = useRef(false);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(ASK_NOTIFICATIONS, () => {
      if (pending.current) return;
      pending.current = true;
      // let the success toast show first
      setTimeout(() => {
        void shouldAskForPermission()
          .then((ask) => {
            if (!ask) return;
            setVisible(true);
            void noteAsked();
          })
          .finally(() => {
            pending.current = false;
          });
      }, 1600);
    });
    return () => sub.remove();
  }, []);

  const turnOn = async () => {
    setVisible(false);
    if (await requestPermission().catch(() => false)) void registerForPush(screen).catch(() => undefined);
  };

  return (
    <Sheet visible={visible} onClose={() => setVisible(false)}>
      <View style={styles.bell}>
        <Ionicons name="notifications" size={26} color="#0A0A0A" />
      </View>
      <Text style={[styles.title, serif]}>Don&apos;t miss the next drop</Text>
      <Text style={styles.sub}>Only things worth a buzz. Change what you get any time in Settings.</Text>
      <View style={styles.points}>
        {POINTS.map((p) => (
          <View key={p.strong} style={styles.point}>
            <View style={[styles.pointIcon, { backgroundColor: p.bg }]}>
              <Ionicons name={p.icon} size={18} color={p.color} />
            </View>
            <Text style={styles.pointText}>
              <Text style={styles.pointStrong}>{p.strong}</Text>
              {p.rest}
            </Text>
          </View>
        ))}
      </View>
      <Pressable onPress={() => void turnOn()} style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]} accessibilityRole="button">
        <Text style={styles.primaryText}>Turn on notifications</Text>
      </Pressable>
      <Pressable onPress={() => setVisible(false)} style={styles.secondary} accessibilityRole="button">
        <Text style={styles.secondaryText}>Not now</Text>
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  bell: { alignSelf: "center", width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center" },
  title: { color: Colors.textPrimary, fontSize: 32, lineHeight: 34, textAlign: "center", marginTop: 14 },
  sub: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 6 },
  points: { gap: 12, marginTop: 20, marginBottom: 20 },
  point: { flexDirection: "row", alignItems: "center", gap: 12 },
  pointIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  pointText: { flex: 1, color: "#DDD9D3", fontSize: 14 },
  pointStrong: { color: Colors.textPrimary, fontWeight: "700" },
  primary: { height: 52, borderRadius: 18, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#0A0A0A", fontSize: 15.5, fontWeight: "800" },
  secondary: { height: 46, alignItems: "center", justifyContent: "center", marginTop: 4 },
  secondaryText: { color: Colors.textSecondary, fontSize: 14.5, fontWeight: "600" },
});
