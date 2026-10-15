import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "../constants";
import Sheet from "./Sheet";

export type SheetAction = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  destructive?: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  actions: SheetAction[];
};

/** A short list of actions in a bottom sheet (the "⋯" menu). */
const ActionSheet = ({ visible, onClose, title, actions }: Props) => (
  <Sheet visible={visible} onClose={onClose}>
    {title ? (
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
    ) : null}
    <View style={styles.list}>
      {actions.map((a) => {
        const color = a.destructive ? "#E45A5A" : Colors.textPrimary;
        return (
          <Pressable
            key={a.key}
            onPress={() => {
              onClose();
              // Let this sheet finish closing before the action opens another one.
              setTimeout(a.onPress, 220);
            }}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Ionicons name={a.icon} size={21} color={color} />
            <Text style={[styles.label, { color }]}>{a.label}</Text>
          </Pressable>
        );
      })}
    </View>
  </Sheet>
);

const styles = StyleSheet.create({
  title: { color: Colors.textMuted, fontSize: 13, fontWeight: "700", marginBottom: 10, paddingHorizontal: 4 },
  list: { gap: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, height: 52, paddingHorizontal: 12, borderRadius: 14 },
  pressed: { backgroundColor: "rgba(255,255,255,0.06)" },
  label: { fontSize: 16, fontWeight: "600" },
});

export default ActionSheet;
