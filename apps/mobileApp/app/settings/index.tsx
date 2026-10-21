import { useCallback, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { router, useFocusEffect } from "expo-router";
import ConfirmModal from "../../components/ConfirmModal";
import Header from "../../components/Header";
import { SettingsRow, SettingsSection } from "../../components/SettingsRow";
import { Colors } from "../../constants";
import { useInsets } from "../../hooks/useInsets";
import { useAuth } from "../../lib/AuthContext";
import { useBlocks } from "../../lib/BlocksContext";
import { PRIVACY_URL, TERMS_URL } from "../../lib/authConfig";
import { useToast } from "../../lib/ToastContext";
import { getInterests } from "../../lib/profileApi";
import { Sentry } from "../../lib/sentry";
import { intervalLabel, loadState } from "../../lib/wallpaperChanger/state";

const CONTACT_URL = "https://www.aurora-walls.com/contact";
const APP_VERSION = Constants.expoConfig?.version ?? "";

/**
 * Settings: the account card (→ Edit profile), account actions, about, and account deletion.
 * New preference rows (wallpaper changer, notifications…) go in their own section here.
 */
const Settings = () => {
  const { user, onLogout } = useAuth();
  const { blocked } = useBlocks();
  const { showToast } = useToast();
  const { bottomPadding } = useInsets();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [changer, setChanger] = useState<string>("");
  const [interests, setInterests] = useState<string>("");

  // Status for the Wallpaper changer row ("Every 6 h" / "Off"); refreshed when returning here.
  useFocusEffect(
    useCallback(() => {
      if (!user) {
        setChanger("Sign in");
        return;
      }
      loadState()
        .then((s) => setChanger(s.enabled ? intervalLabel(s.intervalHours) : "Off"))
        .catch(() => setChanger(""));
    }, [user])
  );

  // Status for the Interests row ("Space, Ocean +1" / "None yet"); refreshed when returning here.
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      getInterests()
        .then((list) =>
          setInterests(list.length ? list.slice(0, 2).map((i) => i.name).join(", ") + (list.length > 2 ? ` +${list.length - 2}` : "") : "None yet")
        )
        .catch(() => setInterests(""));
    }, [user])
  );

  const open = (url: string) => {
    Linking.openURL(url).catch(() => showToast("Couldn't open the link.", { type: "error", position: "top" }));
  };

  const signOut = async () => {
    setConfirmSignOut(false);
    try {
      await onLogout();
      showToast("Signed out.", { type: "success" });
      router.back();
    } catch {
      showToast("Couldn't sign out right now. Please try again.", { type: "error" });
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Settings" logo={false} titleFontSize={20} showBackButton />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + 32 }]} showsVerticalScrollIndicator={false}>
        {user ? (
          <Pressable
            onPress={() => router.push("/settings/profile")}
            style={({ pressed }) => [styles.accountCard, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
          >
            {user.avatarUrl ? (
              <Image source={user.avatarUrl} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Ionicons name="person" size={26} color={Colors.textSecondary} />
              </View>
            )}
            <View style={styles.accountText}>
              <Text style={styles.name} numberOfLines={1}>
                {user.displayName || user.username}
              </Text>
              <Text style={styles.handle} numberOfLines={1}>
                @{user.username}
              </Text>
              <Text style={styles.editHint}>Edit profile</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
          </Pressable>
        ) : (
          <View style={styles.accountCard}>
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Ionicons name="person" size={26} color={Colors.textSecondary} />
            </View>
            <View style={styles.accountText}>
              <Text style={styles.name}>Not signed in</Text>
              <Text style={styles.handle}>Sign in to like, save and sync on any device.</Text>
            </View>
            <Pressable onPress={() => router.push("/auth")} style={({ pressed }) => [styles.signIn, pressed && { opacity: 0.85 }]}>
              <Text style={styles.signInText}>Sign in</Text>
            </Pressable>
          </View>
        )}

        {user ? (
          <SettingsSection title="Your feed">
            <SettingsRow icon="sparkles-outline" label="Interests" value={interests} onPress={() => router.push("/welcome?mode=edit")} />
          </SettingsSection>
        ) : null}

        {user ? (
          <SettingsSection title="Privacy & safety">
            <SettingsRow
              icon="ban-outline"
              label="Blocked creators"
              value={blocked?.length ? String(blocked.length) : undefined}
              onPress={() => router.push("/settings/blocked")}
            />
          </SettingsSection>
        ) : null}

        <SettingsSection title="Wallpaper">
          <SettingsRow icon="sync-outline" label="Wallpaper changer" value={changer} onPress={() => router.push("/settings/wallpaper-changer")} />
        </SettingsSection>

        {user && user.hasPassword !== undefined ? (
          <SettingsSection title="Security">
            <SettingsRow
              icon="key-outline"
              label={user.hasPassword ? "Change password" : "Set a password"}
              onPress={() => router.push("/settings/password")}
            />
          </SettingsSection>
        ) : null}

        <SettingsSection title="About">
          <SettingsRow icon="document-text-outline" label="Terms of service" onPress={() => open(TERMS_URL)} external />
          <SettingsRow icon="shield-checkmark-outline" label="Privacy policy" onPress={() => open(PRIVACY_URL)} external divider />
          <SettingsRow icon="chatbubble-ellipses-outline" label="Contact & feedback" onPress={() => open(CONTACT_URL)} external divider />
          {APP_VERSION ? <SettingsRow icon="information-circle-outline" label="Version" value={APP_VERSION} divider /> : null}
        </SettingsSection>

        {__DEV__ ? (
          <SettingsSection title="Developer (dev builds only)">
            <SettingsRow
              icon="bug-outline"
              label="Send test error to Sentry"
              onPress={() => {
                Sentry.captureException(new Error("Sentry test error from the Aurora app"), { tags: { test: "manual" } });
                showToast("Test error sent. Check Sentry › Issues.", { type: "success", position: "top" });
              }}
            />
          </SettingsSection>
        ) : null}

        {user ? (
          <SettingsSection>
            <SettingsRow icon="log-out-outline" label="Sign out" onPress={() => setConfirmSignOut(true)} />
            <SettingsRow icon="trash-outline" label="Delete account" danger onPress={() => router.push("/settings/delete-account")} divider />
          </SettingsSection>
        ) : null}
      </ScrollView>

      <ConfirmModal
        visible={confirmSignOut}
        title="Sign out?"
        message="You can sign back in any time. Your likes and collections stay saved to your account."
        confirmText="Sign out"
        onConfirm={() => void signOut()}
        onCancel={() => setConfirmSignOut(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  content: { paddingHorizontal: 16, paddingTop: 6, gap: 22 },
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgElevated,
  },
  pressed: { opacity: 0.85 },
  avatar: { width: 58, height: 58, borderRadius: 29 },
  avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.06)" },
  accountText: { flex: 1, gap: 2 },
  name: { color: Colors.textPrimary, fontSize: 17, fontWeight: "800" },
  handle: { color: Colors.textSecondary, fontSize: 13 },
  editHint: { color: Colors.accent, fontSize: 13, fontWeight: "700", marginTop: 4 },
  signIn: { backgroundColor: Colors.accent, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  signInText: { color: "#0A0A0A", fontSize: 14, fontWeight: "800" },
});

export default Settings;
