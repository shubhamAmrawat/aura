import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import AuthError from "../../components/auth/AuthError";
import CodeInput, { CODE_LENGTH } from "../../components/auth/CodeInput";
import PasswordField from "../../components/auth/PasswordField";
import ConfirmModal from "../../components/ConfirmModal";
import Header from "../../components/Header";
import { Colors } from "../../constants";
import { useInsets } from "../../hooks/useInsets";
import { useAuth } from "../../lib/AuthContext";
import { getMe } from "../../lib/authApi";
import { deleteAccount, sendDeleteAccountCode } from "../../lib/profileApi";
import { useToast } from "../../lib/ToastContext";

const DANGER = "#D94848";
const RESEND_AFTER = 60; // the API sends at most one code a minute

/**
 * Permanent account deletion. Every account confirms with a code emailed to it; accounts
 * with a password also enter it (the API enforces both).
 */
const DeleteAccount = () => {
  const { user, onLogout } = useAuth();
  const { showToast } = useToast();
  const { bottomPadding } = useInsets();

  // Ask the server which proof applies, rather than trusting a possibly stale local user.
  const [hasPassword, setHasPassword] = useState<boolean | null>(user?.hasPassword ?? null);
  useEffect(() => {
    getMe()
      .then(({ user: me }) => setHasPassword(me.hasPassword !== false))
      .catch(() => setHasPassword((v) => v ?? true));
  }, []);

  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const sendCode = async () => {
    if (sending || resendIn > 0) return;
    setSending(true);
    setError("");
    try {
      await sendDeleteAccountCode();
      setCodeSent(true);
      setCode("");
      setResendIn(RESEND_AFTER);
      showToast(`Code sent to ${user?.email ?? "your email"}`, { type: "success", position: "top" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the code. Try again.");
    } finally {
      setSending(false);
    }
  };

  const ready = hasPassword !== null && (!hasPassword || password.length > 0) && codeSent && code.length === CODE_LENGTH;

  const doDelete = async () => {
    setConfirming(false);
    setDeleting(true);
    setError("");
    try {
      await deleteAccount(hasPassword ? { password, otp: code } : { otp: code });
      await onLogout();
      router.dismissAll();
      router.replace("/");
      showToast("Your account has been deleted.", { type: "success", position: "top" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete your account. Try again.");
      setDeleting(false);
    }
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Header title="Delete account" logo={false} titleFontSize={20} showBackButton />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Delete account" logo={false} titleFontSize={20} showBackButton />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.warning}>
            <View style={styles.warningIcon}>
              <Ionicons name="warning-outline" size={22} color={DANGER} />
            </View>
            <Text style={styles.warningTitle}>This permanently deletes your account</Text>
            <Text style={styles.body}>
              @{user.username} and everything in it will be removed from Aurora. This can&apos;t be undone.
            </Text>
            <View style={styles.list}>
              {[
                "Your profile, photo and cover",
                "Your likes",
                "Your collections",
                "Wallpapers you uploaded",
              ].map((item) => (
                <View key={item} style={styles.listRow}>
                  <Ionicons name="close-circle" size={16} color={DANGER} />
                  <Text style={styles.listText}>{item}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.note}>Your download history is kept without your name on it.</Text>
          </View>

          <Text style={styles.stepTitle}>Confirm it&apos;s you</Text>

          {hasPassword === null ? (
            <ActivityIndicator color={Colors.accent} style={{ alignSelf: "flex-start" }} />
          ) : (
            <>
            {hasPassword ? (
            <View style={styles.stepBody}>
              <Text style={styles.body}>1. Enter your password.</Text>
              <PasswordField
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (error) setError("");
                }}
                placeholder="Password"
                status={/password/i.test(error) ? "error" : "idle"}
                autoComplete="current-password"
                returnKeyType="done"
                onSubmitEditing={() => ready && setConfirming(true)}
              />
            </View>
            ) : null}
            <View style={styles.stepBody}>
              <Text style={styles.body}>
                {hasPassword ? "2. " : ""}Get a 6-digit code sent to <Text style={styles.strong}>{user.email}</Text> and enter it below.
              </Text>
              {codeSent ? (
                <>
                  <CodeInput
                    value={code}
                    onChange={(v) => {
                      setCode(v);
                      if (error) setError("");
                    }}
                  />
                  <Pressable onPress={sendCode} disabled={sending || resendIn > 0} hitSlop={8}>
                    <Text style={[styles.link, (sending || resendIn > 0) && styles.linkDisabled]}>
                      {resendIn > 0 ? `Resend code in ${resendIn}s` : sending ? "Sending…" : "Resend code"}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  onPress={sendCode}
                  disabled={sending}
                  style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.85 }]}
                >
                  {sending ? <ActivityIndicator color={Colors.textPrimary} size="small" /> : <Text style={styles.secondaryText}>Send code</Text>}
                </Pressable>
              )}
            </View>
            </>
          )}

          <AuthError message={error} />

          <Pressable
            onPress={() => setConfirming(true)}
            disabled={!ready || deleting}
            style={({ pressed }) => [styles.deleteBtn, (!ready || deleting) && styles.disabled, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            {deleting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={18} color="#fff" />
                <Text style={styles.deleteText}>Delete my account</Text>
              </>
            )}
          </Pressable>
          <Pressable onPress={() => router.back()} style={styles.cancel} hitSlop={8} disabled={deleting}>
            <Text style={styles.cancelText}>Keep my account</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmModal
        visible={confirming}
        title="Delete your account?"
        message="Your profile, likes, collections and uploads will be permanently deleted."
        confirmText="Delete permanently"
        onConfirm={() => void doDelete()}
        onCancel={() => setConfirming(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  content: { paddingHorizontal: 16, paddingTop: 6, gap: 16 },
  warning: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(228, 90, 90, 0.35)",
    backgroundColor: "rgba(228, 90, 90, 0.06)",
    padding: 16,
    gap: 10,
  },
  warningIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(228, 90, 90, 0.14)",
  },
  warningTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: "800" },
  body: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  strong: { color: Colors.textPrimary, fontWeight: "700" },
  list: { gap: 8, marginTop: 2 },
  listRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  listText: { color: Colors.textPrimary, fontSize: 14 },
  note: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  stepTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: "800", marginTop: 6 },
  stepBody: { gap: 12 },
  link: { color: Colors.accent, fontSize: 14, fontWeight: "700" },
  linkDisabled: { color: Colors.textMuted },
  secondaryBtn: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderHover,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { color: Colors.textPrimary, fontSize: 15, fontWeight: "700" },
  deleteBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: DANGER,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  disabled: { opacity: 0.4 },
  deleteText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  cancel: { alignSelf: "center", paddingVertical: 6 },
  cancelText: { color: Colors.textSecondary, fontSize: 14, fontWeight: "700" },
});

export default DeleteAccount;
