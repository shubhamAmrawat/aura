import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import AuthError from "../../components/auth/AuthError";
import CodeInput, { CODE_LENGTH } from "../../components/auth/CodeInput";
import PasswordField from "../../components/auth/PasswordField";
import Header from "../../components/Header";
import { Colors } from "../../constants";
import { useInsets } from "../../hooks/useInsets";
import { useAuth } from "../../lib/AuthContext";
import { confirmPasswordChange, requestSetPasswordCode, setPasswordWithCode, startPasswordChange } from "../../lib/profileApi";
import { useToast } from "../../lib/ToastContext";

const MIN_LENGTH = 8; // same rule as the API
const RESEND_AFTER = 60; // the API sends at most one code a minute for "set a password"

/**
 * Change password (current password → emailed code + new password), or, for accounts made
 * with Google, set a first password (emailed code + new password) so email sign-in works too.
 */
const ChangePassword = () => {
  const { user, setUser } = useAuth();
  const { showToast } = useToast();
  const { bottomPadding } = useInsets();
  const mode: "change" | "set" = user?.hasPassword === false ? "set" : "change";

  const [step, setStep] = useState<"verify" | "new">("verify");
  const [resendIn, setResendIn] = useState(0);
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);
  const [current, setCurrent] = useState("");
  const [code, setCode] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const tooShort = next.length > 0 && next.length < MIN_LENGTH;
  const mismatch = repeat.length > 0 && repeat !== next;
  const canVerify = (mode === "set" || current.length > 0) && !busy;
  const canSave = code.length === CODE_LENGTH && next.length >= MIN_LENGTH && repeat === next && !busy;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const verify = () =>
    run(async () => {
      if (mode === "set") {
        if (resendIn > 0) return;
        await requestSetPasswordCode(user!.email);
        setResendIn(RESEND_AFTER);
      } else {
        await startPasswordChange(current);
      }
      setStep("new");
      setCode("");
      showToast(`Code sent to ${user?.email ?? "your email"}`, { type: "success", position: "top" });
    });

  const save = () =>
    run(async () => {
      if (mode === "set") {
        await setPasswordWithCode(user!.email, code, next);
        setUser((prev) => (prev ? { ...prev, hasPassword: true } : prev));
        showToast("Password set. You can now also sign in with your email.", { type: "success", position: "top" });
      } else {
        await confirmPasswordChange(code, next);
        showToast("Password changed.", { type: "success", position: "top" });
      }
      router.back();
    });

  return (
    <View style={styles.container}>
      <Header title={mode === "set" ? "Set a password" : "Change password"} logo={false} titleFontSize={20} showBackButton />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === "verify" && mode === "set" ? (
            <Text style={styles.body}>
              You signed up with Google. Add a password to also sign in with <Text style={styles.strong}>{user?.email}</Text> and a
              password. We&apos;ll email you a code to confirm it&apos;s you. Google sign-in keeps working.
            </Text>
          ) : step === "verify" ? (
            <>
              <Text style={styles.body}>Enter your current password. We&apos;ll email you a code to confirm the change.</Text>
              <PasswordField
                value={current}
                onChangeText={(v) => {
                  setCurrent(v);
                  if (error) setError("");
                }}
                placeholder="Current password"
                status={error ? "error" : "idle"}
                autoComplete="current-password"
                returnKeyType="done"
                onSubmitEditing={() => canVerify && void verify()}
              />
            </>
          ) : (
            <>
              <Text style={styles.body}>
                Enter the 6-digit code sent to <Text style={styles.strong}>{user?.email}</Text>, then your new password.
              </Text>
              <CodeInput value={code} onChange={setCode} />
              <PasswordField
                value={next}
                onChangeText={setNext}
                placeholder={`New password (${MIN_LENGTH}+ characters)`}
                status={tooShort ? "error" : next.length >= MIN_LENGTH ? "ok" : "idle"}
                showStatusIcon
                autoComplete="new-password"
              />
              <PasswordField
                value={repeat}
                onChangeText={setRepeat}
                placeholder="Repeat new password"
                status={mismatch ? "error" : repeat.length > 0 && repeat === next ? "ok" : "idle"}
                showStatusIcon
                autoComplete="new-password"
              />
              {tooShort ? <Text style={styles.hint}>Use at least {MIN_LENGTH} characters.</Text> : null}
              {mismatch ? <Text style={styles.hint}>The passwords don&apos;t match.</Text> : null}
            </>
          )}

          <AuthError message={error} />

          <Pressable
            onPress={() => void (step === "verify" ? verify() : save())}
            disabled={step === "verify" ? !canVerify : !canSave}
            style={({ pressed }) => [
              styles.primary,
              (step === "verify" ? !canVerify : !canSave) && styles.disabled,
              pressed && { opacity: 0.85 },
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#0A0A0A" size="small" />
            ) : (
              <Text style={styles.primaryText}>
                {step === "verify" ? "Send code" : mode === "set" ? "Set password" : "Change password"}
              </Text>
            )}
          </Pressable>
          {step === "new" ? (
            <Pressable onPress={() => void verify()} disabled={busy || resendIn > 0} hitSlop={8} style={styles.resend}>
              <Text style={[styles.link, resendIn > 0 && styles.linkDisabled]}>
                {resendIn > 0 ? `Send a new code in ${resendIn}s` : "Send a new code"}
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  content: { paddingHorizontal: 16, paddingTop: 6, gap: 14 },
  body: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  strong: { color: Colors.textPrimary, fontWeight: "700" },
  hint: { color: "#F06464", fontSize: 13 },
  primary: {
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  primaryText: { color: "#0A0A0A", fontSize: 16, fontWeight: "800" },
  disabled: { opacity: 0.4 },
  resend: { alignSelf: "center", paddingVertical: 4 },
  link: { color: Colors.accent, fontSize: 14, fontWeight: "700" },
  linkDisabled: { color: Colors.textMuted },
});

export default ChangePassword;
