import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants";
import Sheet from "./Sheet";
import { useToast } from "../lib/ToastContext";
import { reportContent, ReportReason, USER_REPORT_REASONS, WALLPAPER_REPORT_REASONS } from "../lib/moderationApi";

export type ReportTarget = { type: "wallpaper" | "user"; id: string; label: string };

type Props = { target: ReportTarget | null; onClose: () => void };

const DETAILS_MAX = 500;

/** "Report wallpaper" / "Report @creator": pick a reason, add optional details, send. */
const ReportSheet = ({ target, onClose }: Props) => {
  const { showToast } = useToast();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!target) return;
    setReason(null);
    setDetails("");
    setSending(false);
  }, [target]);

  const reasons = target?.type === "user" ? USER_REPORT_REASONS : WALLPAPER_REPORT_REASONS;

  const send = async () => {
    if (!target || !reason || sending) return;
    setSending(true);
    try {
      await reportContent({ targetType: target.type, targetId: target.id, reason, details: details.trim() || undefined });
      onClose();
      showToast("Thanks for reporting. We'll review it soon.", { type: "success", position: "top" });
    } catch (e) {
      setSending(false);
      showToast(e instanceof Error ? e.message : "Couldn't send the report. Try again.", { type: "error", position: "top" });
    }
  };

  return (
    <Sheet visible={!!target} onClose={onClose}>
      <Text style={styles.title}>{target?.type === "user" ? `Report ${target.label}` : "Report wallpaper"}</Text>
      <Text style={styles.sub}>Your report is anonymous to the creator. What's wrong?</Text>
      <View style={styles.list}>
        {reasons.map((r) => {
          const on = reason === r.value;
          return (
            <Pressable
              key={r.value}
              onPress={() => setReason(r.value)}
              style={({ pressed }) => [styles.row, on && styles.rowOn, pressed && styles.pressed]}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
            >
              <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={20} color={on ? Colors.accent : Colors.textSecondary} />
              <Text style={styles.rowText}>{r.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        value={details}
        onChangeText={(t) => setDetails(t.slice(0, DETAILS_MAX))}
        placeholder="Add details (optional)"
        placeholderTextColor={Colors.textMuted}
        multiline
        style={styles.input}
        maxLength={DETAILS_MAX}
      />
      <Pressable
        onPress={() => void send()}
        disabled={!reason || sending}
        style={({ pressed }) => [styles.button, (!reason || sending) && styles.buttonOff, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
      >
        {sending ? <ActivityIndicator color="#0A0A0A" /> : <Text style={styles.buttonText}>Send report</Text>}
      </Pressable>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  title: { color: Colors.textPrimary, fontSize: 18, fontWeight: "700", marginTop: 4 },
  sub: { color: Colors.textSecondary, fontSize: 13, marginTop: 4, marginBottom: 12 },
  list: { gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 46, paddingHorizontal: 10, borderRadius: 12 },
  rowOn: { backgroundColor: Colors.accentMuted },
  pressed: { backgroundColor: "rgba(255,255,255,0.06)" },
  rowText: { color: Colors.textPrimary, fontSize: 15, flex: 1 },
  input: {
    marginTop: 12,
    minHeight: 72,
    maxHeight: 140,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderHover,
    backgroundColor: Colors.bgSecondary,
    color: Colors.textPrimary,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    textAlignVertical: "top",
  },
  button: { marginTop: 14, height: 50, borderRadius: 14, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center" },
  buttonOff: { opacity: 0.45 },
  buttonText: { color: "#0A0A0A", fontSize: 16, fontWeight: "700" },
});

export default ReportSheet;
