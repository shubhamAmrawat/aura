import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import Header from "../components/Header";
import { Colors } from "../constants";
import { useAuth } from "../lib/AuthContext";
import { router } from "expo-router";
import ConfirmModal from "../components/ConfirmModal";
import { useToast } from "../lib/ToastContext";
import { Images } from "../constants";



function formatDate(value?: string) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function Profile() {
  const { user, loaded, onLogout } = useAuth();
  const { showToast } = useToast();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    setShowLogoutConfirm(false);
    try {
      await onLogout();
      showToast("Logged out successfully.", { type: "success" });
      router.replace("/");
    } catch {
      showToast("Unable to log out right now. Please try again.", { type: "error" });
    }
  };

  if (!loaded) {
    return (
      <View style={styles.container}>
        <Header title="Profile" logo={false} titleFontSize={20} showBackButton={true} />
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>Loading profile...</Text>
          <Text style={styles.stateSubtext}>Fetching your account details.</Text>
        </View>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <Header title="Profile" logo={false} titleFontSize={20} showBackButton={true} />
        <View style={styles.centerState}>
          <Ionicons name="person-circle-outline" size={52} color={Colors.accent} />
          <Text style={styles.stateTitle}>No active session</Text>
          <Text style={styles.stateSubtext}>Sign in to view your profile details.</Text>
        </View>
      </View>
    );
  }

  const isCreator = Boolean(user.isCreator);

  return (
    <View style={styles.container}>
      <Header title="Profile" logo={false} titleFontSize={20} showBackButton={true} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.coverWrap}>
          <View style={styles.coverCard}>
            <Image
              source={{ uri: user.coverUrl || Images.DEFAULT_COVER_IMAGE_URL }}
              style={styles.coverImage}
              contentFit="cover"
            />
          </View>
          <Image
            source={{ uri: user.avatarUrl || Images.DEFAULT_PROFILE_IMAGE_URL }}
            style={styles.floatingAvatar}
            contentFit="cover"
          />
        </View>

        <View style={styles.infoCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text-outline" size={16} color={Colors.accent} />
            <Text style={styles.sectionTitle}>Bio</Text>
          </View>
          <Text style={styles.bioText}>{user.bio?.trim() ? user.bio : "No bio added yet."}</Text>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeader}>
              <Ionicons name="person-circle-outline" size={16} color={Colors.accent} />
              <Text style={styles.sectionTitle}>Account Information</Text>
            </View>
            {isCreator && (
              <View style={styles.badge}>
                <Ionicons name="color-wand-outline" size={14} color={Colors.accent} />
                <Text style={styles.badgeText}>Creator</Text>
              </View>
            )}
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoKeyWrap}>
              <Ionicons name="id-card-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.infoKey}>Name</Text>
            </View>
            <Text style={styles.infoValue}>{user.displayName || user.username}</Text>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoKeyWrap}>
              <Ionicons name="at-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.infoKey}>Username</Text>
            </View>
            <Text style={styles.infoValue}>@{user.username}</Text>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoKeyWrap}>
              <Ionicons name="mail-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.infoKey}>Email</Text>
            </View>
            <Text style={styles.infoValue}>{user.email}</Text>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoKeyWrap}>
              <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.infoKey}>Joined</Text>
            </View>
            <Text style={styles.infoValue}>{formatDate(user.createdAt)}</Text>
          </View>
        </View>

        <View style={styles.gridRow}>
          <View style={styles.statCard}>
            <View style={styles.statLabelRow}>
              <Ionicons name="cloud-upload-outline" size={15} color={Colors.textSecondary} />
              <Text style={styles.statLabel}>Uploads</Text>
            </View>
            <Text style={styles.statValue}>{user.totalUploads ?? 0}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statLabelRow}>
              <Ionicons name="cloud-download-outline" size={15} color={Colors.textSecondary} />
              <Text style={styles.statLabel}>Downloads</Text>
            </View>
            <Text style={styles.statValue}>{user.totalDownloads ?? 0}</Text>
          </View>
        </View>

        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color="#ffffff" />
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </ScrollView>
      <ConfirmModal
        visible={showLogoutConfirm}
        title="Confirm Logout"
        message="Are you sure you want to log out from your account?"
        confirmText="Yes, Logout"
        confirmVariant="danger"
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={() => {
          void confirmLogout();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgSecondary },
  scrollContent: {
    padding: 14,
    gap: 12,
    paddingBottom: 36,
  },
  coverWrap: {
    position: "relative",
    marginBottom: 44,
  },
  coverCard: {
    backgroundColor: Colors.bgElevated,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  coverImage: {
    width: "100%",
    height: 150,
    backgroundColor: Colors.bgPrimary,
  },
  floatingAvatar: {
    position: "absolute",
    bottom: -44,
    alignSelf: "center",
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 3,
    borderColor: Colors.bgSecondary,
    backgroundColor: Colors.bgPrimary,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 8,
  },
  stateTitle: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: "700",
  },
  stateSubtext: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: "center",
  },
  badge: {
    backgroundColor: Colors.bgPrimary,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 4,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  badgeText: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: "600",
  },
  gridRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.bgElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 6,
  },
  statLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  statLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statValue: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: "700",
  },
  infoCard: {
    backgroundColor: Colors.bgElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    gap: 10,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  infoKeyWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  infoKey: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  infoValue: {
    color: Colors.textPrimary,
    fontSize: 13,
    flex: 1,
    textAlign: "right",
  },
  bioText: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  logoutButton: {
    marginTop: 6,
    backgroundColor: "#D64545",
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  logoutText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
});