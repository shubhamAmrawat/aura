import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Colors } from "../constants";
import { useAuth } from "../lib/AuthContext";

/** Top-right avatar on the tab screens; opens Settings (profile, account, about). */
const AvatarButton = () => {
  const { user } = useAuth();
  return (
    <Pressable
      onPress={() => router.push("/settings")}
      hitSlop={8}
      style={({ pressed }) => [styles.wrap, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
      accessibilityLabel={user ? "Settings and profile" : "Settings"}
    >
      {user?.avatarUrl ? (
        <Image source={user.avatarUrl} style={styles.image} contentFit="cover" transition={150} />
      ) : (
        <View style={styles.fallback}>
          <Ionicons name="person" size={17} color={Colors.textSecondary} />
        </View>
      )}
    </Pressable>
  );
};

const SIZE = 34;
const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, overflow: "hidden", borderWidth: 1, borderColor: Colors.borderHover },
  image: { width: "100%", height: "100%" },
  fallback: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bgElevated },
});

export default AvatarButton;
