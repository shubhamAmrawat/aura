import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Sentry } from "../lib/sentry";

const BG = "#111111";
const ACCENT = "#81EE4E";

/**
 * Shown instead of a blank screen when a screen crashes while rendering (expo-router's
 * ErrorBoundary). Reports the error once, then offers Retry. Uses no app context on purpose:
 * it can render outside every provider.
 */
export default function ErrorScreen({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <View style={styles.container}>
      <View style={styles.icon}>
        <Ionicons name="planet-outline" size={34} color={ACCENT} />
      </View>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.text}>This screen ran into a problem. We&apos;ve been notified. Try again, it usually works.</Text>
      <Pressable onPress={() => void retry()} style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]} accessibilityRole="button">
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
      {__DEV__ ? (
        <Text style={styles.dev} numberOfLines={6}>
          {error.message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 12 },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(129, 238, 78, 0.12)",
    marginBottom: 6,
  },
  title: { color: "#F5F0EB", fontSize: 20, fontWeight: "800" },
  text: { color: "#888888", fontSize: 14, lineHeight: 20, textAlign: "center" },
  button: { marginTop: 10, backgroundColor: ACCENT, borderRadius: 999, paddingHorizontal: 28, paddingVertical: 12 },
  buttonText: { color: "#0A0A0A", fontSize: 15, fontWeight: "800" },
  dev: { marginTop: 16, color: "#E45A5A", fontSize: 12, textAlign: "center" },
});
