import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import Header from "../components/Header";
import { Colors } from "../constants";
import { useAuth } from "../lib/AuthContext";
import { router } from "expo-router";
import ConfirmModal from "../components/ConfirmModal";
import { useToast } from "../lib/ToastContext";
import { Images } from "../constants";
import {
  confirmAvatarUpload,
  confirmCoverUpload,
  getAvatarUploadUrl,
  getCoverUploadUrl,
  updateProfile,
  uploadAvatarDirect,
  uploadAvatarToSignedUrl,
  uploadCoverDirect,
  uploadCoverToSignedUrl,
} from "../lib/profileApi";
import { ensureCameraPermission, ensureMediaLibraryPermission } from "../lib/permissions";
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const MAX_COVER_BYTES = 10 * 1024 * 1024;

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
  const { user, loaded, onLogout, setUser } = useAuth();
  const { showToast } = useToast();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [sourcePickerTarget, setSourcePickerTarget] = useState<"avatar" | "cover" | null>(null);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    displayName: "",
    username: "",
    bio: "",
    contactNo: "",
  });

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

  useEffect(() => {
    if (!user) return;
    setForm({
      displayName: user.displayName ?? "",
      username: user.username ?? "",
      bio: user.bio ?? "",
      contactNo: user.contactNo ?? "",
    });
  }, [user]);

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

  const normalizedInitial = useMemo(
    () => ({
      displayName: (user.displayName ?? "").trim(),
      username: (user.username ?? "").trim().replace(/^@+/, ""),
      bio: (user.bio ?? "").trim(),
      contactNo: (user.contactNo ?? "").trim(),
    }),
    [user]
  );

  const normalizedCurrent = useMemo(
    () => ({
      displayName: form.displayName.trim(),
      username: form.username.trim().replace(/^@+/, ""),
      bio: form.bio.trim(),
      contactNo: form.contactNo.trim(),
    }),
    [form]
  );

  const hasChanges =
    normalizedCurrent.displayName !== normalizedInitial.displayName ||
    normalizedCurrent.username !== normalizedInitial.username ||
    normalizedCurrent.bio !== normalizedInitial.bio ||
    normalizedCurrent.contactNo !== normalizedInitial.contactNo;

  const validateForm = () => {
    if (!normalizedCurrent.displayName) return "Display name is required.";
    if (normalizedCurrent.displayName.length > 50) return "Display name must be 50 characters or less.";
    if (!normalizedCurrent.username) return "Username is required.";
    if (normalizedCurrent.username.length < 3 || normalizedCurrent.username.length > 30) {
      return "Username must be between 3 and 30 characters.";
    }
    if (!/^[a-zA-Z0-9._]+$/.test(normalizedCurrent.username)) {
      return "Username can only contain letters, numbers, dot and underscore.";
    }
    if (normalizedCurrent.bio.length > 280) return "Bio must be 280 characters or less.";
    if (
      normalizedCurrent.contactNo &&
      (!/^[0-9+\-\s()]+$/.test(normalizedCurrent.contactNo) ||
        normalizedCurrent.contactNo.replace(/\D/g, "").length < 7 ||
        normalizedCurrent.contactNo.replace(/\D/g, "").length > 15)
    ) {
      return "Enter a valid contact number.";
    }
    return "";
  };

  const startEditing = () => {
    setFormError("");
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setForm({
      displayName: user.displayName ?? "",
      username: user.username ?? "",
      bio: user.bio ?? "",
      contactNo: user.contactNo ?? "",
    });
    setFormError("");
    setIsEditing(false);
  };

  const handleSaveProfile = async () => {
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    if (!hasChanges) {
      setIsEditing(false);
      return;
    }

    setFormError("");
    setIsSaving(true);
    try {
      const { user: updatedUser } = await updateProfile({
        displayName: normalizedCurrent.displayName,
        username: normalizedCurrent.username,
        bio: normalizedCurrent.bio,
        contactNo: normalizedCurrent.contactNo,
      });

      setUser((prev) => (prev ? { ...prev, ...updatedUser } : updatedUser));
      setIsEditing(false);
      showToast("Profile updated successfully.", { type: "success" });
    } catch (e: any) {
      setFormError(e.message || "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const requestImagePermission = async (source: "camera" | "gallery") => {
    if (source === "camera") {
      const granted = await ensureCameraPermission();
      if (!granted) {
        showToast("Camera permission is required to take a photo.", { type: "error" });
        return false;
      }
      return true;
    }

    const granted = await ensureMediaLibraryPermission();
    if (!granted) {
      showToast("Photo permission is required to pick from gallery.", { type: "error" });
      return false;
    }
    return true;
  };

  const pickImage = async (target: "avatar" | "cover", source: "camera" | "gallery") => {
    const hasPermission = await requestImagePermission(source);
    if (!hasPermission) return null;

    const pickerOptions: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: target === "avatar" ? [1, 1] : [16, 9],
      quality: 0.92,
    };
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync(pickerOptions)
        : await ImagePicker.launchImageLibraryAsync(pickerOptions);

    if (result.canceled || !result.assets?.[0]) return null;
    return result.assets[0];
  };

  const ensureValidImage = (
    mimeType: string | undefined,
    fileSize: number | undefined,
    target: "avatar" | "cover"
  ) => {
    const normalizedMimeType = (mimeType || "image/jpeg").toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.includes(normalizedMimeType)) {
      throw new Error("Only JPEG, PNG and WebP images are allowed.");
    }
    const limit = target === "avatar" ? MAX_AVATAR_BYTES : MAX_COVER_BYTES;
    if (typeof fileSize === "number" && fileSize > limit) {
      throw new Error(
        target === "avatar"
          ? "Avatar must be smaller than 5MB."
          : "Cover must be smaller than 10MB."
      );
    }
    return normalizedMimeType;
  };

  const handleAvatarPickWithSource = async (source: "camera" | "gallery") => {
    const asset = await pickImage("avatar", source);
    if (!asset) return;

    setFormError("");
    setUploadingAvatar(true);
    try {
      const mimeType = ensureValidImage(asset.mimeType, asset.fileSize, "avatar");
      let avatarUrl = "";
      try {
        const { uploadUrl, fileUrl, key } = await getAvatarUploadUrl(mimeType);
        await uploadAvatarToSignedUrl(uploadUrl, asset.uri, mimeType);
        avatarUrl = await confirmAvatarUpload(fileUrl, key);
      } catch {
        avatarUrl = await uploadAvatarDirect(asset.uri, mimeType);
      }
      setUser((prev) => (prev ? { ...prev, avatarUrl } : prev));
      showToast("Avatar updated successfully.", { type: "success" });
    } catch (e: any) {
      setFormError(e.message || "Failed to update avatar.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCoverPickWithSource = async (source: "camera" | "gallery") => {
    const asset = await pickImage("cover", source);
    if (!asset) return;

    setFormError("");
    setUploadingCover(true);
    try {
      const mimeType = ensureValidImage(asset.mimeType, asset.fileSize, "cover");
      let coverUrl = "";
      try {
        const { uploadUrl, fileUrl, key } = await getCoverUploadUrl(mimeType);
        await uploadCoverToSignedUrl(uploadUrl, asset.uri, mimeType);
        coverUrl = await confirmCoverUpload(fileUrl, key);
      } catch {
        coverUrl = await uploadCoverDirect(asset.uri, mimeType);
      }
      setUser((prev) => (prev ? { ...prev, coverUrl } : prev));
      showToast("Cover updated successfully.", { type: "success" });
    } catch (e: any) {
      setFormError(e.message || "Failed to update cover.");
    } finally {
      setUploadingCover(false);
    }
  };

  const openSourcePicker = (target: "avatar" | "cover") => {
    if (uploadingAvatar || uploadingCover) return;
    setSourcePickerTarget(target);
  };

  const closeSourcePicker = () => {
    setSourcePickerTarget(null);
  };

  const removeCurrentPhoto = () => {
    const target = sourcePickerTarget;
    closeSourcePicker();
    if (!target) return;
    showToast(
      target === "avatar"
        ? "Remove avatar is not available yet."
        : "Remove cover is not available yet.",
      { type: "info" }
    );
  };

  const handleSourceSelection = (source: "camera" | "gallery") => {
    const target = sourcePickerTarget;
    closeSourcePicker();
    if (!target) return;
    if (target === "avatar") {
      void handleAvatarPickWithSource(source);
      return;
    }
    void handleCoverPickWithSource(source);
  };

  return (
    <View style={styles.container}>
      <Header title="Profile" logo={false} titleFontSize={20} showBackButton={true} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.coverWrap}>
          <View style={styles.coverCard}>
            <Image
              source={{ uri: user.coverUrl || Images.DEFAULT_COVER_IMAGE_URL }}
              style={styles.coverImage}
              contentFit="cover"
            />
            <Pressable
              style={({ pressed }) => [styles.coverEditButton, pressed && { opacity: 0.85 }]}
              onPress={() => {
                openSourcePicker("cover");
              }}
              disabled={uploadingCover || uploadingAvatar}
            >
              {uploadingCover ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="image-outline" size={14} color="#ffffff" />
                  <Text style={styles.coverEditText}>Change cover</Text>
                </>
              )}
            </Pressable>
          </View>
          <Pressable
            style={styles.avatarWrap}
            onPress={() => {
              openSourcePicker("avatar");
            }}
            disabled={uploadingAvatar || uploadingCover}
          >
            <Image
              source={{ uri: user.avatarUrl || Images.DEFAULT_PROFILE_IMAGE_URL }}
              style={styles.floatingAvatar}
              contentFit="cover"
            />
            <View style={styles.avatarOverlay}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Ionicons name="camera-outline" size={16} color="#ffffff" />
              )}
            </View>
          </Pressable>
        </View>

        <View style={styles.profileHeaderCard}>
          <Text style={styles.profileName}>{user.displayName || user.username}</Text>
          <Text style={styles.profileHandle}>@{user.username}</Text>
          {/* <Text style={styles.imageHint}>Tap avatar or cover to crop and update</Text> */}
          {/* <View style={styles.profileBadges}>
            {user.isPro ? (
              <View style={styles.proBadge}>
                <Text style={styles.proBadgeText}>Pro</Text>
              </View>
            ) : null}
            {isCreator && (
              <View style={styles.badge}>
                <Ionicons name="color-wand-outline" size={14} color={Colors.accent} />
                <Text style={styles.badgeText}>Creator</Text>
              </View>
            )}
          </View> */}
        </View>

        <View style={styles.infoCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text-outline" size={16} color={Colors.accent} />
              <Text style={styles.sectionTitle}>Bio</Text>
            </View>
            {!isEditing ? (
              <Pressable onPress={startEditing} style={styles.editPill}>
                <Ionicons name="create-outline" size={14} color={Colors.accent} />
                <Text style={styles.editPillText}>Edit</Text>
              </Pressable>
            ) : null}
          </View>
          {isEditing ? (
            <View style={styles.inputWrap}>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={form.bio}
                onChangeText={(value) => setForm((prev) => ({ ...prev, bio: value }))}
                placeholder="Tell people about yourself"
                placeholderTextColor={Colors.textMuted}
                multiline
                maxLength={280}
                textAlignVertical="top"
              />
              <Text style={styles.helperText}>{`${form.bio.length}/280`}</Text>
            </View>
          ) : (
            <Text style={styles.bioText}>{user.bio?.trim() ? user.bio : "No bio added yet."}</Text>
          )}
        </View>

        <View style={styles.infoCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person-circle-outline" size={16} color={Colors.accent} />
            <Text style={styles.sectionTitle}>Account Information</Text>
          </View>
          {isEditing ? (
            <>
              <View style={styles.fieldGroup}>
                <View style={styles.infoKeyWrap}>
                  <Ionicons name="id-card-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.infoKey}>Name</Text>
                </View>
                <TextInput
                  style={styles.input}
                  value={form.displayName}
                  onChangeText={(value) => setForm((prev) => ({ ...prev, displayName: value }))}
                  placeholder="Display name"
                  placeholderTextColor={Colors.textMuted}
                  maxLength={50}
                />
              </View>
              <View style={styles.fieldGroup}>
                <View style={styles.infoKeyWrap}>
                  <Ionicons name="at-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.infoKey}>Username</Text>
                </View>
                <TextInput
                  style={styles.input}
                  value={form.username}
                  onChangeText={(value) => setForm((prev) => ({ ...prev, username: value.replace(/^@+/, "") }))}
                  placeholder="username"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={30}
                />
              </View>
              <View style={styles.fieldGroup}>
                <View style={styles.infoKeyWrap}>
                  <Ionicons name="call-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.infoKey}>Contact</Text>
                </View>
                <TextInput
                  style={styles.input}
                  value={form.contactNo}
                  onChangeText={(value) => setForm((prev) => ({ ...prev, contactNo: value }))}
                  placeholder="Phone number (optional)"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="phone-pad"
                  maxLength={20}
                />
              </View>
            </>
          ) : (
            <>
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
                  <Ionicons name="call-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.infoKey}>Contact</Text>
                </View>
                <Text style={styles.infoValue}>{user.contactNo?.trim() ? user.contactNo : "Not added"}</Text>
              </View>
            </>
          )}
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
          {isEditing ? (
            <Text style={styles.helperText}>
              Username can be changed only once every 2 weeks.
            </Text>
          ) : null}
          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
          {isEditing ? (
            <View style={styles.editActions}>
              <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed && { opacity: 0.85 }]}
                onPress={cancelEditing}
                disabled={isSaving}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  (!hasChanges || isSaving) && styles.primaryButtonDisabled,
                  pressed && hasChanges && !isSaving && { opacity: 0.92 },
                ]}
                onPress={handleSaveProfile}
                disabled={!hasChanges || isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color={Colors.bgPrimary} size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Save changes</Text>
                )}
              </Pressable>
            </View>
          ) : null}
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
      <Modal
        visible={Boolean(sourcePickerTarget)}
        transparent
        animationType="fade"
        onRequestClose={closeSourcePicker}
      >
        <Pressable style={styles.sourceBackdrop} onPress={closeSourcePicker}>
          <Pressable style={styles.sourceSheet} onPress={() => {}}>
            <Text style={styles.sourceTitle}>
              {sourcePickerTarget === "avatar" ? "Update avatar" : "Update cover"}
            </Text>
            <Text style={styles.sourceSubtitle}>Choose image source</Text>
            <View style={styles.sourceButtons}>
              <Pressable
                style={({ pressed }) => [styles.sourceButton, pressed && { opacity: 0.9 }]}
                onPress={() => handleSourceSelection("camera")}
              >
                <Ionicons name="camera-outline" size={16} color={Colors.textPrimary} />
                <Text style={styles.sourceButtonText}>Take photo</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.sourceButton, pressed && { opacity: 0.9 }]}
                onPress={() => handleSourceSelection("gallery")}
              >
                <Ionicons name="images-outline" size={16} color={Colors.textPrimary} />
                <Text style={styles.sourceButtonText}>Choose from gallery</Text>
              </Pressable>
              {/* Temporarily hidden until remove avatar/cover API flow is implemented.
              <Pressable
                style={({ pressed }) => [styles.sourceButton, pressed && { opacity: 0.9 }]}
                onPress={removeCurrentPhoto}
              >
                <Ionicons name="trash-outline" size={16} color="#E05252" />
                <Text style={[styles.sourceButtonText, styles.sourceDangerText]}>Remove photo</Text>
              </Pressable>
              */}
            </View>
            <Pressable style={styles.sourceCancelButton} onPress={closeSourcePicker}>
              <Text style={styles.sourceCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgSecondary },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    gap: 12,
    paddingBottom: 28,
  },
  coverWrap: {
    position: "relative",
    marginBottom: 52,
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
    height: 158,
    backgroundColor: Colors.bgPrimary,
  },
  coverEditButton: {
    position: "absolute",
    right: 10,
    bottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(0,0,0,0.52)",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  coverEditText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  avatarWrap: {
    position: "absolute",
    bottom: -44,
    alignSelf: "center",
  },
  floatingAvatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 3,
    borderColor: Colors.bgSecondary,
    backgroundColor: Colors.bgPrimary,
  },
  avatarOverlay: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(0,0,0,0.68)",
    alignItems: "center",
    justifyContent: "center",
  },
  profileHeaderCard: {
    backgroundColor: Colors.bgElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    gap: 4,
  },
  profileName: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: "700",
  },
  profileHandle: {
    color: Colors.accent,
    fontSize: 13,
  },
  imageHint: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  profileBadges: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  proBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(64,192,87,0.28)",
    backgroundColor: "rgba(64,192,87,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  proBadgeText: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: "700",
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
    minHeight: 24,
  },
  fieldGroup: {
    gap: 6,
  },
  infoKeyWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    width: 124,
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
    lineHeight: 20,
  },
  bioText: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  inputWrap: {
    gap: 6,
  },
  input: {
    backgroundColor: Colors.bgPrimary,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 10,
    color: Colors.textPrimary,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  textArea: {
    minHeight: 90,
  },
  helperText: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  errorText: {
    color: "#E05252",
    fontSize: 12,
  },
  editPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    backgroundColor: Colors.bgPrimary,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  editPillText: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: "700",
  },
  editActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  secondaryButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgPrimary,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  primaryButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: Colors.accent,
    paddingVertical: 10,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: Colors.bgPrimary,
    fontSize: 14,
    fontWeight: "700",
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
  sourceBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.58)",
    justifyContent: "flex-end",
    padding: 16,
  },
  sourceSheet: {
    backgroundColor: Colors.bgElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 10,
  },
  sourceTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  sourceSubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  sourceButtons: {
    gap: 8,
    marginTop: 4,
  },
  sourceButton: {
    backgroundColor: Colors.bgPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sourceButtonText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  sourceDangerText: {
    color: "#E05252",
  },
  sourceCancelButton: {
    marginTop: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgPrimary,
  },
  sourceCancelText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
});