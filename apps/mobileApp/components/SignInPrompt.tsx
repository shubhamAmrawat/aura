import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Colors } from "../constants";

type Props = { icon: keyof typeof Ionicons.glyphMap; title: string; text: string };

/** Logged-out state for tabs that need an account. */
const SignInPrompt = ({ icon, title, text }: Props) => (
  <View style={styles.wrap}>
    <View style={styles.iconWrap}>
      <Ionicons name={icon} size={30} color={Colors.accent} />
    </View>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.text}>{text}</Text>
    <Pressable onPress={() => router.push("/auth")} style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}>
      <Text style={styles.buttonText}>Sign in</Text>
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 10,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.accentMuted,
    marginBottom: 6,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
  },
  text: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  button: {
    marginTop: 10,
    backgroundColor: Colors.accent,
    borderRadius: 999,
    paddingHorizontal: 28,
    paddingVertical: 11,
  },
  buttonText: {
    color: "#0A0A0A",
    fontSize: 15,
    fontWeight: "800",
  },
});

export default SignInPrompt;
