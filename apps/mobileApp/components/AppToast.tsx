import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";

export type ToastType = "success" | "error" | "info";
export type ToastPosition = "top" | "bottom";

type AppToastProps = {
  visible: boolean;
  message: string;
  type?: ToastType;
  position?: ToastPosition;
  onClose?: () => void;
  action?: { label: string; onPress: () => void };
};

// Light "inverted" surface so the toast stands out from the dark UI.
const SURFACE = "#F5F0EB";
const INK = "#111111";
const INK_MUTED = "#55524E";

const TOAST_THEME: Record<
  ToastType,
  { icon: keyof typeof Ionicons.glyphMap; color: string; tint: string }
> = {
  success: { icon: "checkmark", color: "#1E9E50", tint: "rgba(30, 158, 80, 0.14)" },
  error: { icon: "alert", color: "#D23F3F", tint: "rgba(210, 63, 63, 0.14)" },
  info: { icon: "information", color: "#2F7D12", tint: "rgba(47, 125, 18, 0.14)" },
};

export default function AppToast({
  visible,
  message,
  type = "info",
  position = "bottom",
  onClose,
  action,
}: AppToastProps) {
  const anim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  // Keep the last content on screen while the exit animation runs.
  const [shown, setShown] = useState({ message, type, position, action });

  useEffect(() => {
    if (visible) {
      setShown({ message, type, position, action });
      setMounted(true);
      anim.stopAnimation();
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      Animated.timing(anim, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => finished && setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, message, type, position]);

  if (!mounted) return null;
  const theme = TOAST_THEME[shown.type];
  const isTop = shown.position === "top";
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [isTop ? -16 : 16, 0] });

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, isTop ? styles.wrapperTop : styles.wrapperBottom]}
    >
      <Animated.View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[styles.shadow, { opacity: anim, transform: [{ translateY }] }]}
      >
        <View style={styles.toast}>
        <View style={[styles.stripe, { backgroundColor: theme.color }]} />
        <View style={[styles.badge, { backgroundColor: theme.tint }]}>
          <Ionicons name={theme.icon} size={15} color={theme.color} />
        </View>
        <Text style={styles.message} numberOfLines={2}>
          {shown.message}
        </Text>
        {shown.action ? (
          <Pressable
            onPress={shown.action.onPress}
            hitSlop={8}
            style={styles.action}
            accessibilityRole="button"
          >
            <Text style={styles.actionText}>{shown.action.label}</Text>
          </Pressable>
        ) : null}
        {!!onClose && (
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Dismiss">
            <Ionicons name="close" size={18} color={INK_MUTED} />
          </Pressable>
        )}
        </View>
      </Animated.View>
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
  shadow: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 14,
    backgroundColor: SURFACE,
    elevation: 14,
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  toast: {
    borderRadius: 14,
    paddingLeft: 16,
    paddingRight: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    overflow: "hidden",
  },
  stripe: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  badge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    flex: 1,
    color: INK,
    fontSize: 13.5,
    fontWeight: "600",
  },
  action: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: INK,
  },
  actionText: {
    color: "#81EE4E",
    fontSize: 13,
    fontWeight: "800",
  },
});
