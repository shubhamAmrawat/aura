import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Colors } from "../constants";

/** Shown for a link the app doesn't recognise (e.g. an old or mistyped Aurora link). */
export default function NotFound() {
  return (
    <View style={styles.wrap}>
      <View style={styles.icon}>
        <Ionicons name="compass-outline" size={30} color={Colors.accent} />
      </View>
      <Text style={styles.title}>This page isn&apos;t in the app</Text>
      <Text style={styles.text}>The link may be old or mistyped. Have a look around instead.</Text>
      <Pressable onPress={() => router.replace("/")} style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]} accessibilityRole="button">
        <Text style={styles.buttonText}>Go to home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.bgPrimary, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 10 },
  icon: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.accentMuted, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  title: { color: Colors.textPrimary, fontSize: 18, fontWeight: "800", textAlign: "center" },
  text: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: "center" },
  button: { marginTop: 10, backgroundColor: Colors.accent, borderRadius: 999, paddingHorizontal: 28, paddingVertical: 11 },
  buttonText: { color: "#0A0A0A", fontSize: 15, fontWeight: "800" },
});
