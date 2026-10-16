import { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants";

const DANGER = "#E45A5A";

/** A titled group of rows on the Settings screen. */
export function SettingsSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      <View style={styles.card}>{children}</View>
    </View>
  );
}

type RowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  /** Muted text on the right (e.g. the app version). */
  value?: string;
  onPress?: () => void;
  /** Opens outside the app: shows an arrow-out icon instead of a chevron. */
  external?: boolean;
  danger?: boolean;
  /** Draw the divider above this row (every row but the first in a section). */
  divider?: boolean;
};

export function SettingsRow({ icon, label, value, onPress, external, danger, divider }: RowProps) {
  const color = danger ? DANGER : Colors.textPrimary;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, divider && styles.divider, pressed && styles.pressed]}
      accessibilityRole={onPress ? (external ? "link" : "button") : "text"}
    >
      <View style={[styles.iconWrap, danger && styles.iconDanger]}>
        <Ionicons name={icon} size={18} color={danger ? DANGER : Colors.textPrimary} />
      </View>
      <Text style={[styles.label, { color }]} numberOfLines={1}>
        {label}
      </Text>
      {value ? <Text style={styles.value}>{value}</Text> : null}
      {onPress ? (
        <Ionicons name={external ? "open-outline" : "chevron-forward"} size={external ? 16 : 18} color={Colors.textMuted} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  sectionTitle: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    paddingHorizontal: 6,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgElevated,
    overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingHorizontal: 14 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderHover },
  pressed: { backgroundColor: "rgba(255,255,255,0.05)" },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  iconDanger: { backgroundColor: "rgba(228, 90, 90, 0.12)" },
  label: { flex: 1, fontSize: 15, fontWeight: "600" },
  value: { color: Colors.textMuted, fontSize: 14 },
});
