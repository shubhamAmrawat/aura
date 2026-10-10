"use client";

import { forgotPassword, login, loginWithGoogle, loginWithPassword, resetPassword, sendOtp, signup, verifyOtp, verifyResetCode } from "@/lib/authApi";
import GoogleSignIn from "@/app/components/GoogleSignIn";
import { queueToast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import Logo from "@/app/components/Logo";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/authContext";
import { useSearchParams } from "next/navigation";
const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [otp, setOtp] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const passwordsMatch = password.length >= 8 && password === confirmPassword;
  const showMismatch =
    confirmPassword.length > 0 &&
    !passwordsMatch &&
    (confirmTouched || confirmPassword.length >= password.length);
  const { refreshUser } = useAuth();
  // Sign-in method: password (default) · otp (code by email) · forgot → code → reset
  const [view, setView] = useState<"password" | "otp" | "forgot" | "code" | "reset">(
    searchParams.get("view") === "forgot" ? "forgot" : "password"
  );
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [confirmNewTouched, setConfirmNewTouched] = useState(false);
  const newPasswordTooShort = newPassword.length > 0 && newPassword.length < 8;
  const newPasswordsMatch = newPassword.length >= 8 && newPassword === confirmNewPassword;
  const showNewMismatch =
    confirmNewPassword.length > 0 &&
    !newPasswordsMatch &&
    (confirmNewTouched || confirmNewPassword.length >= newPassword.length);
  const [info, setInfo] = useState("");
  // Live email validation (same rule as the API)
  const [emailTouched, setEmailTouched] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const showEmailError = email.length > 0 && !emailValid && emailTouched;
  const resetFlow = mode === "login" && (view === "forgot" || view === "code" || view === "reset");

  const goTo = (v: typeof view) => { setView(v); setStep(1); setError(""); setInfo(""); setOtp(""); };

  const finishLogin = async (message: string) => {
    await refreshUser();
    queueToast(message, "success");
    setNavigating(true);
    router.push(next ? decodeURIComponent(next) : "/");
  };

  const handleGoogle = async (credential: string) => {
    setLoading(true);
    setError("");
    try {
      const { isNewUser } = await loginWithGoogle(credential);
      await finishLogin(isNewUser ? "Account created! Welcome to Aurora" : "Welcome back!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
      setLoading(false);
    }
  };

  const handlePasswordLogin = async () => {
    setLoading(true);
    setError("");
    try {
      await loginWithPassword({ email, password: loginPassword });
      await finishLogin("Welcome back!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    setLoading(true);
    setError("");
    try {
      await forgotPassword(email);
      setInfo("If an account exists for this email, we've sent a 6-digit code.");
      setResetCode("");
      setView("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyResetCode = async () => {
    setLoading(true);
    setError("");
    try {
      await verifyResetCode({ email, otp: resetCode });
      setInfo("");
      setNewPassword("");
      setConfirmNewPassword("");
      setConfirmNewTouched(false);
      setView("reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (newPassword.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (newPassword !== confirmNewPassword) { setError("Passwords do not match"); return; }
    setLoading(true);
    setError("");
    try {
      await resetPassword({ email, newPassword });
      await loginWithPassword({ email, password: newPassword });
      await finishLogin("Password updated. Welcome back!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  const handleSendOTP = async () => {
    setLoading(true);
    setError("");
    try {
      await sendOtp({ email, type: mode });
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setLoading(true);
    setError("");
    try {
      await verifyOtp({ email, code: otp, type: mode });
      if (mode === "signup") {
        setStep(3);
      } else {
        await handleLogin();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    setLoading(true);
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      setLoading(false);
      return;
    }
    try {
      await signup({ email, username, displayName, password });
      await refreshUser();
      queueToast("Account created! Welcome to Aurora", "success");
      setNavigating(true);
      router.push(next ? decodeURIComponent(next) : "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      await login({ email });
      await refreshUser();
      queueToast("Welcome back!", "success");
      setNavigating(true);
      router.push(next ? decodeURIComponent(next) : "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  const inputStyle = {
    background: "var(--bg-elevated)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
    outline: "none",
  };

  return (
    <main
      className="min-h-screen flex"
      style={{ background: "var(--bg-primary)" }}
    >
      {/* ── LEFT — visual panel ── */}
      <div className="hidden lg:block relative w-[55%] flex-shrink-0">
        <Image
          src="/wallhaven-zpoxyj.png"
          alt="Aurora wallpaper"
          fill
          className="object-cover"
          priority
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(10,10,10,0.2) 0%, rgba(10,10,10,0.65) 100%)",
          }}
        />
        <div className="absolute inset-0 flex flex-col justify-between p-12 z-10">
          <Logo href="/" />
          <div className="max-w-xs">
            <p
              className="text-xl font-light leading-relaxed mb-3"
              style={{
                color: "rgba(245,240,235,0.88)",
                fontStyle: "italic",
              }}
            >
              &quot;The world is full of magic things, patiently waiting for our senses to grow sharper.&quot;
            </p>
            <p
              className="text-xs tracking-[0.25em] uppercase"
              style={{ color: "var(--accent)" }}
            >
              — W.B. Yeats
            </p>
          </div>
        </div>
      </div>

      {/* ── RIGHT — form panel ── */}
      <div className="flex-1 flex flex-col min-h-screen">

        {/* top bar — back link */}
        <div className="flex items-center justify-between px-10 py-5">
          <div className="lg:hidden">
            <Logo href="/" />
          </div>
          <div className="lg:ml-auto">
            <Link
              href="/"
              className="text-xs tracking-widest uppercase transition-opacity hover:opacity-60"
              style={{ color: "var(--text-muted)" }}
            >
              ← Back to Aurora
            </Link>
          </div>
        </div>

        {/* centered form */}
        <div className="flex-1 flex items-center justify-center px-8 py-8">
          <div className="w-full max-w-[340px]">

            {/* step progress — signup only */}
            {mode === "signup" && (
              <div className="flex gap-1.5 mb-10">
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className="h-[2px] flex-1 rounded-full transition-all duration-500"
                    style={{
                      background: s <= step ? "var(--accent)" : "var(--bg-elevated)",
                    }}
                  />
                ))}
              </div>
            )}

            {/* heading */}
            <div className="mb-7">
              <h2
                className="text-[28px] font-bold leading-tight mb-1.5"
                style={{ color: "var(--text-primary)" }}
              >
                {mode === "login" && view === "forgot" && "Reset your password"}
                {mode === "login" && view === "code" && "Check your inbox"}
                {mode === "login" && view === "reset" && "Choose a new password"}
                {!resetFlow && (
                  <>
                    {step === 1 && (mode === "login" ? "Welcome back" : "Join Aurora")}
                    {step === 2 && "Check your inbox"}
                    {step === 3 && "Almost there"}
                  </>
                )}
              </h2>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                {step === 1 && mode === "login" && view === "password" && "Sign in to continue"}
                {step === 1 && mode === "login" && view === "otp" && "We'll email you a sign-in code"}
                {mode === "login" && view === "forgot" && "Enter your email and we'll send you a code"}
                {mode === "login" && view === "code" && (
                  <>Enter the code sent to <span style={{ color: "var(--text-primary)" }}>{email}</span></>
                )}
                {mode === "login" && view === "reset" && (
                  <>Set a new password for <span style={{ color: "var(--text-primary)" }}>{email}</span></>
                )}
                {step === 1 && mode === "signup" && "Create your account to get started"}
                {step === 2 && !resetFlow && (
                  <>We sent a code to <span style={{ color: "var(--text-primary)" }}>{email}</span></>
                )}
                {step === 3 && "Set up your profile to finish"}
              </p>
            </div>

            {info && !error && (
              <p className="text-xs mb-5 px-1" style={{ color: "var(--text-secondary)" }}>
                {info}
              </p>
            )}

            {/* error */}
            {error && (
              <p
                className="text-xs mb-5 px-1"
                style={{ color: "#ef4444" }}
              >
                {error}
              </p>
            )}

            {/* ── STEP 1 ── */}
            {step === 1 && (
              <div className="flex flex-col gap-3">
                {(mode === "signup" || view === "password" || view === "otp") && (
                  <div
                    className="flex rounded-lg p-0.5"
                    style={{ background: "var(--bg-elevated)" }}
                  >
                    {(["login", "signup"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => { setMode(m); setError(""); setInfo(""); if (m === "login") setView("password"); }}
                        className="flex-1 py-2 text-xs font-medium tracking-wider uppercase rounded-md transition-all duration-200"
                        style={{
                          background: mode === m ? "var(--accent)" : "transparent",
                          color: mode === m ? "var(--bg-primary)" : "var(--text-secondary)",
                        }}
                      >
                        {m === "login" ? "Sign in" : "Sign up"}
                      </button>
                    ))}
                  </div>
                )}

                {/* Google (One Tap suggests the signed-in account) */}
                {(mode === "signup" || view === "password" || view === "otp") && (
                  <>
                    <div className="mt-2">
                      <GoogleSignIn
                        key={mode}
                        context={mode === "signup" ? "signup" : "signin"}
                        onCredential={handleGoogle}
                      />
                    </div>
                    <div className="flex items-center gap-3 my-1">
                      <div className="h-px flex-1" style={{ background: "var(--border)" }} />
                      <span className="text-[10px] tracking-[0.2em] uppercase" style={{ color: "var(--text-muted)" }}>or</span>
                      <div className="h-px flex-1" style={{ background: "var(--border)" }} />
                    </div>
                  </>
                )}

                {!(mode === "login" && (view === "code" || view === "reset")) && (
                <div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value.trim()); setError(""); }}
                    placeholder="your@email.com"
                    autoComplete="email"
                    className="w-full px-4 py-3 rounded-lg text-sm transition-all"
                    style={{
                      ...inputStyle,
                      borderColor: showEmailError ? "#ef4444" : emailFocused ? "var(--accent)" : "var(--border)",
                    }}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => { setEmailFocused(false); setEmailTouched(true); }}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      setEmailTouched(true);
                      if (!emailValid) return;
                      if (mode === "signup" || view === "otp") handleSendOTP();
                      else if (view === "forgot") handleForgot();
                    }}
                  />
                  {showEmailError && (
                    <p className="text-xs mt-1.5 ml-1" style={{ color: "#ef4444" }}>
                      Enter a valid email address
                    </p>
                  )}
                </div>
                )}

                {/* Sign in with password (default) */}
                {mode === "login" && view === "password" && (
                  <>
                    <div className="relative">
                      <input
                        type={showLoginPassword ? "text" : "password"}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Password"
                        autoComplete="current-password"
                        className="w-full px-4 py-3 pr-11 rounded-lg text-sm transition-all"
                        style={inputStyle}
                        onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                        onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                        onKeyDown={(e) => e.key === "Enter" && emailValid && loginPassword && handlePasswordLogin()}
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 transition-opacity hover:opacity-60"
                        style={{ color: "var(--text-muted)" }}
                        tabIndex={-1}
                        aria-label={showLoginPassword ? "Hide password" : "Show password"}
                      >
                        {showLoginPassword ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                    <button
                      onClick={handlePasswordLogin}
                      disabled={loading || !emailValid || !loginPassword}
                      className="w-full py-3 rounded-lg text-sm font-medium tracking-wide transition-opacity hover:opacity-80 disabled:opacity-40 mt-1"
                      style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
                    >
                      {loading ? "Signing in..." : "Sign in"}
                    </button>
                    <div className="flex items-center justify-between mt-1">
                      <button onClick={() => goTo("forgot")} className="text-xs transition-opacity hover:opacity-60" style={{ color: "var(--text-muted)" }}>
                        Forgot password?
                      </button>
                      <button onClick={() => goTo("otp")} className="text-xs transition-opacity hover:opacity-60" style={{ color: "var(--accent)" }}>
                        Sign in with a code instead
                      </button>
                    </div>
                  </>
                )}

                {/* Sign in with an emailed code, or sign up */}
                {(mode === "signup" || view === "otp") && (
                  <>
                    <button
                      onClick={handleSendOTP}
                      disabled={loading || !emailValid}
                      className="w-full py-3 rounded-lg text-sm font-medium tracking-wide transition-opacity hover:opacity-80 disabled:opacity-40 mt-1"
                      style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
                    >
                      {loading ? "Sending..." : mode === "login" ? "Email me a code" : "Continue"}
                    </button>
                    {mode === "login" && (
                      <button onClick={() => goTo("password")} className="text-xs self-end mt-1 transition-opacity hover:opacity-60" style={{ color: "var(--accent)" }}>
                        Use password instead
                      </button>
                    )}
                  </>
                )}

                {/* Forgot password: request a code */}
                {mode === "login" && view === "forgot" && (
                  <>
                    <button
                      onClick={handleForgot}
                      disabled={loading || !emailValid}
                      className="w-full py-3 rounded-lg text-sm font-medium tracking-wide transition-opacity hover:opacity-80 disabled:opacity-40 mt-1"
                      style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
                    >
                      {loading ? "Sending..." : "Send reset code"}
                    </button>
                    <button onClick={() => goTo("password")} className="text-xs self-start mt-1 transition-opacity hover:opacity-60" style={{ color: "var(--text-muted)" }}>
                      ← Back to sign in
                    </button>
                  </>
                )}

                {/* Forgot step 2: enter the emailed code */}
                {mode === "login" && view === "code" && (
                  <>
                    <input
                      type="text"
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="Enter 6-digit code"
                      maxLength={6}
                      autoComplete="one-time-code"
                      className="w-full px-4 py-3 rounded-lg text-sm tracking-widest text-center transition-all"
                      style={inputStyle}
                      onKeyDown={(e) => e.key === "Enter" && resetCode.length === 6 && handleVerifyResetCode()}
                      autoFocus
                    />
                    <button
                      onClick={handleVerifyResetCode}
                      disabled={loading || resetCode.length !== 6}
                      className="w-full py-3 rounded-lg text-sm font-medium tracking-wide transition-opacity hover:opacity-80 disabled:opacity-40 mt-1"
                      style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
                    >
                      {loading ? "Verifying..." : "Verify code"}
                    </button>
                    <div className="flex items-center justify-between mt-1">
                      <button onClick={() => goTo("forgot")} className="text-xs transition-opacity hover:opacity-60" style={{ color: "var(--text-muted)" }}>
                        ← Change email
                      </button>
                      <button onClick={handleForgot} disabled={loading} className="text-xs transition-opacity hover:opacity-60" style={{ color: "var(--accent)" }}>
                        Resend code
                      </button>
                    </div>
                  </>
                )}

                {/* Forgot step 3: new password (code already verified) */}
                {mode === "login" && view === "reset" && (
                  <>
                    {/* New password: eye toggle + live length hint */}
                    <div>
                      <div className="relative">
                        <input
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => { setNewPassword(e.target.value); setError(""); }}
                          placeholder="New password (min 8 characters)"
                          autoComplete="new-password"
                          className="w-full px-4 py-3 pr-11 rounded-lg text-sm transition-all"
                          style={{ ...inputStyle, borderColor: newPasswordTooShort ? "#ef4444" : "var(--border)" }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 transition-opacity hover:opacity-60"
                          style={{ color: "var(--text-muted)" }}
                          tabIndex={-1}
                          aria-label={showNewPassword ? "Hide password" : "Show password"}
                        >
                          {showNewPassword ? <EyeOffIcon /> : <EyeIcon />}
                        </button>
                      </div>
                      {newPasswordTooShort && (
                        <p className="text-xs mt-1.5 ml-1" style={{ color: "#ef4444" }}>
                          At least 8 characters ({8 - newPassword.length} more)
                        </p>
                      )}
                    </div>

                    {/* Confirm: eye toggle + live match / mismatch */}
                    <div>
                      <div className="relative">
                        <input
                          type={showConfirmNewPassword ? "text" : "password"}
                          value={confirmNewPassword}
                          onChange={(e) => { setConfirmNewPassword(e.target.value); setError(""); }}
                          onBlur={() => setConfirmNewTouched(true)}
                          placeholder="Repeat new password"
                          autoComplete="new-password"
                          className="w-full px-4 py-3 pr-[4.5rem] rounded-lg text-sm transition-all"
                          style={{
                            ...inputStyle,
                            borderColor: !confirmNewPassword
                              ? "var(--border)"
                              : newPasswordsMatch
                                ? "#40C057"
                                : showNewMismatch
                                  ? "#ef4444"
                                  : "var(--border)",
                          }}
                          onKeyDown={(e) => e.key === "Enter" && newPasswordsMatch && handleReset()}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                          {confirmNewPassword && newPasswordsMatch && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#40C057" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                          {confirmNewPassword && showNewMismatch && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          )}
                          <button
                            type="button"
                            onClick={() => setShowConfirmNewPassword((v) => !v)}
                            className="p-0.5 transition-opacity hover:opacity-60"
                            style={{ color: "var(--text-muted)" }}
                            tabIndex={-1}
                            aria-label={showConfirmNewPassword ? "Hide password" : "Show password"}
                          >
                            {showConfirmNewPassword ? <EyeOffIcon /> : <EyeIcon />}
                          </button>
                        </div>
                      </div>
                      {showNewMismatch && (
                        <p className="text-xs mt-1.5 ml-1" style={{ color: "#ef4444" }}>
                          Passwords do not match
                        </p>
                      )}
                    </div>
                    <button
                      onClick={handleReset}
                      disabled={loading || !newPasswordsMatch}
                      className="w-full py-3 rounded-lg text-sm font-medium tracking-wide transition-opacity hover:opacity-80 disabled:opacity-40 mt-1"
                      style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
                    >
                      {loading ? "Saving..." : "Set new password"}
                    </button>
                    <button onClick={() => goTo("forgot")} className="text-xs self-start mt-1 transition-opacity hover:opacity-60" style={{ color: "var(--text-muted)" }}>
                      ← Start over
                    </button>
                  </>
                )}
              </div>
            )}

            {/* ── STEP 2 ── */}
            {step === 2 && (
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  className="w-full px-4 py-3 rounded-lg text-sm tracking-widest text-center transition-all"
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                  onKeyDown={(e) => e.key === "Enter" && otp.length === 6 && handleVerifyOtp()}
                  autoFocus
                />

                <button
                  onClick={handleVerifyOtp}
                  disabled={loading || otp.length !== 6}
                  className="w-full py-3 rounded-lg text-sm font-medium tracking-wide transition-opacity hover:opacity-80 disabled:opacity-40"
                  style={{
                    background: "var(--accent)",
                    color: "var(--bg-primary)",
                  }}
                >
                  {loading ? "Verifying..." : "Verify code"}
                </button>

                <div className="flex items-center justify-between mt-1">
                  <button
                    onClick={() => { setStep(1); setOtp(""); setError(""); }}
                    className="text-xs transition-opacity hover:opacity-60"
                    style={{ color: "var(--text-muted)" }}
                  >
                    ← Change email
                  </button>
                  <button
                    onClick={handleSendOTP}
                    disabled={loading}
                    className="text-xs transition-opacity hover:opacity-60"
                    style={{ color: "var(--accent)" }}
                  >
                    Resend code
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 3 ── */}
            {step === 3 && (
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-4 py-3 rounded-lg text-sm transition-all"
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                />

                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
                  placeholder="username"
                  className="w-full px-4 py-3 rounded-lg text-sm transition-all"
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                />

                {/* Password with visibility toggle */}
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className="w-full px-4 py-3 pr-11 rounded-lg text-sm transition-all"
                    style={inputStyle}
                    onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 transition-opacity hover:opacity-60"
                    style={{ color: "var(--text-muted)" }}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>

                {/* Confirm password with visibility toggle + inline validation */}
                <div>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className="w-full px-4 py-3 pr-[4.5rem] rounded-lg text-sm transition-all"
                      style={{
                        ...inputStyle,
                        borderColor: !confirmPassword
                          ? confirmFocused ? "var(--accent)" : "var(--border)"
                          : passwordsMatch
                            ? "#40C057"
                            : showMismatch
                              ? "#ef4444"
                              : confirmFocused ? "var(--accent)" : "var(--border)",
                      }}
                      onFocus={() => setConfirmFocused(true)}
                      onBlur={() => {
                        setConfirmFocused(false);
                        setConfirmTouched(true);
                      }}
                      onKeyDown={(e) =>
                        e.key === "Enter" &&
                        displayName && username && passwordsMatch &&
                        handleSignup()
                      }
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      {confirmPassword && passwordsMatch && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#40C057" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                      {confirmPassword && showMismatch && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        className="p-0.5 transition-opacity hover:opacity-60"
                        style={{ color: "var(--text-muted)" }}
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                  </div>
                  {showMismatch && (
                    <p className="text-xs mt-1.5 ml-1" style={{ color: "#ef4444" }}>
                      Passwords do not match
                    </p>
                  )}
                </div>

                <button
                  onClick={handleSignup}
                  disabled={loading || !displayName || !username || !password || !confirmPassword}
                  className="w-full py-3 rounded-lg text-sm font-medium tracking-wide transition-opacity hover:opacity-80 disabled:opacity-40 mt-1"
                  style={{
                    background: "var(--accent)",
                    color: "var(--bg-primary)",
                  }}
                >
                  {loading ? "Creating account..." : "Create account"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {navigating && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center flex-col gap-6"
          style={{ background: "var(--bg-primary)" }}
        >
          <Logo href="/" />

          {/* sliding accent bar */}
          <div
            className="relative h-[2px] rounded-full overflow-hidden"
            style={{ width: 120, background: "var(--border)" }}
          >
            <div
              className="absolute top-0 left-0 h-full rounded-full"
              style={{
                width: "40%",
                background: "var(--accent)",
                animation: "aurora-slide 1.2s ease-in-out infinite",
              }}
            />
          </div>

          <p
            className="text-xs tracking-[0.3em] uppercase"
            style={{ color: "var(--text-muted)" }}
          >
            Entering Aurora
          </p>
        </div>
      )}
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}