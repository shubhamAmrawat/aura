import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "../constants";

export type ToastType = "success" | "error" | "info";
export type ToastPosition = "top" | "bottom";

type AppToastProps = {
  visible: boolean;
  message: string;
  type?: ToastType;
  position?: ToastPosition;
  onClose?: () => void;
};

const TOAST_THEME: Record<ToastType, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  success: { icon: "checkmark-circle", color: "#35C76F" },
  error: { icon: "alert-circle", color: "#E45A5A" },
  info: { icon: "information-circle", color: Colors.accent },
};

export default function AppToast({
  visible,
  message,
  type = "info",
  position = "bottom",
  onClose,
}: AppToastProps) {
  if (!visible) return null;
  const theme = TOAST_THEME[type];

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, position === "top" ? styles.wrapperTop : styles.wrapperBottom]}
    >
      <View style={styles.toast}>
        <Ionicons name={theme.icon} size={18} color={theme.color} />
        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>
        {!!onClose && (
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={18} color={Colors.textSecondary} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 9999,
    paddingHorizontal: 14,
  },
  wrapperTop: {
    top: 78,
  },
  wrapperBottom: {
    bottom: 80,
  },
  toast: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  message: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: "500",
  },
});
