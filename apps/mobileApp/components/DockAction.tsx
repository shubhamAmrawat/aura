import { ReactNode } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { Colors } from "../constants";

type Props = {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
  activeColor?: string;
  accessibilityLabel?: string;
};

/** A button in the detail screen's bottom dock (same look as Download / Apply / Details). */
const DockAction = ({ icon, label, onPress, disabled, active, activeColor = Colors.accent, accessibilityLabel }: Props) => (
  <Pressable
    style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}
    onPress={onPress}
    disabled={disabled}
    hitSlop={6}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel ?? label}
    accessibilityState={{ selected: active, disabled }}
  >
    {icon}
    <Text style={[styles.label, active && { color: activeColor }]} numberOfLines={1}>
      {label}
    </Text>
  </Pressable>
);

const styles = StyleSheet.create({
  button: {
    flex: 1,
    alignItems: "center",
    gap: 5,
  },
  label: {
    color: Colors.textPrimary,
    fontSize: 11,
    fontWeight: "600",
  },
});

export default DockAction;
