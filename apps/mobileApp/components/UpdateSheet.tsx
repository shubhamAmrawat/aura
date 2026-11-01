import { useCallback, useEffect, useState } from "react";
import { DeviceEventEmitter, Pressable, StyleSheet, Text, View } from "react-native";
import { useFonts } from "expo-font";
import Sheet from "./Sheet";
import { Colors } from "../constants";
import {
  UPDATE_REQUESTED,
  checkForAppUpdate,
  completeAppUpdate,
  currentVersion,
  notePrompted,
  onUpdateState,
  shouldPrompt,
  startAppUpdate,
  type UpdatePlan,
} from "../lib/appUpdate";

const SERIF = "InstrumentSerif";
type Stage = "available" | "downloading" | "ready";

/**
 * "A new version is ready" → (Play) downloading in the background → "Restart to finish".
 * Checked a few seconds after launch, and when a notification's Update button opens the app.
 */
export default function UpdateSheetHost() {
  const [fontsLoaded] = useFonts({ [SERIF]: require("../assets/fonts/InstrumentSerif-Regular.ttf") });
  const serif = fontsLoaded ? { fontFamily: SERIF, fontWeight: "400" as const } : { fontWeight: "700" as const };
  const [plan, setPlan] = useState<UpdatePlan>({ kind: "none" });
  const [visible, setVisible] = useState(false);
  const [stage, setStage] = useState<Stage>("available");
  const [progress, setProgress] = useState(0);

  const check = useCallback(async (force: boolean) => {
    const p = await checkForAppUpdate().catch(() => ({ kind: "none" }) as UpdatePlan);
    setPlan(p);
    if (p.kind === "none") return;
    if (p.kind === "play" && p.required && !p.downloaded) {
      // older than the minimum: Play's own full-screen update
      void startAppUpdate(true);
      return;
    }
    setStage(p.kind === "play" && p.downloaded ? "ready" : "available");
    if (force || (await shouldPrompt(p))) {
      setVisible(true);
      void notePrompted();
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void check(false), 4000);
    const sub = DeviceEventEmitter.addListener(UPDATE_REQUESTED, () => void check(true));
    const off = onUpdateState((s) => {
      if (s.status === "downloading") {
        setStage("downloading");
        setProgress(s.totalBytes > 0 ? s.bytesDownloaded / s.totalBytes : 0);
      } else if (s.status === "downloaded") {
        setStage("ready");
        setVisible(true);
      } else if (s.status === "failed" || s.status === "canceled") {
        setStage("available");
      }
    });
    return () => {
      clearTimeout(t);
      sub.remove();
      off();
    };
  }, [check]);

  const required = plan.kind !== "none" && plan.required;
  const close = () => {
    if (!required || stage === "downloading") setVisible(false);
  };

  const primary = async () => {
    if (stage === "ready") {
      await completeAppUpdate();
      return;
    }
    if (stage === "downloading") {
      setVisible(false);
      return;
    }
    const accepted = await startAppUpdate(false);
    if (accepted) setStage("downloading");
    else if (plan.kind === "store") setVisible(required); // went to the Play Store
  };

  const heading = stage === "ready" ? "Update downloaded" : stage === "downloading" ? "Updating Aurora" : "A new version is ready";
  const primaryLabel = stage === "ready" ? "Restart to finish" : stage === "downloading" ? "Keep using the app" : plan.kind === "store" ? "Get it on Play" : "Update";
  const latest = plan.kind === "store" && plan.latest ? `Version ${plan.latest} · ` : "";

  return (
    <Sheet visible={visible} onClose={close}>
      <View style={styles.head}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>A</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.title, serif]}>{heading}</Text>
          <Text style={styles.meta}>{latest}you have {currentVersion()}</Text>
        </View>
      </View>

      <Text style={styles.body}>
        {required
          ? "This version of Aurora is no longer supported. Update to keep using the app."
          : stage === "ready"
            ? "Restart Aurora to start using the new version. It takes a few seconds."
            : "New features and fixes. The download happens in the background while you keep browsing."}
      </Text>

      {stage === "downloading" ? (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
      ) : null}

      <View style={{ gap: 8, marginTop: 18 }}>
        <Pressable onPress={() => void primary()} style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]} accessibilityRole="button">
          <Text style={styles.primaryText}>{primaryLabel}</Text>
        </Pressable>
        {!required && stage !== "downloading" ? (
          <Pressable onPress={() => setVisible(false)} style={styles.secondary} accessibilityRole="button">
            <Text style={styles.secondaryText}>Later</Text>
          </Pressable>
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 14 },
  badge: { width: 56, height: 56, borderRadius: 16, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#0A0A0A", fontSize: 28, fontWeight: "800" },
  title: { color: Colors.textPrimary, fontSize: 30, lineHeight: 32 },
  meta: { color: Colors.textMuted, fontSize: 13 },
  body: { color: Colors.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 16 },
  track: { height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.1)", overflow: "hidden", marginTop: 16 },
  fill: { height: "100%", borderRadius: 4, backgroundColor: Colors.accent },
  primary: { height: 52, borderRadius: 18, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#0A0A0A", fontSize: 15.5, fontWeight: "800" },
  secondary: { height: 46, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: Colors.textSecondary, fontSize: 14.5, fontWeight: "600" },
});
