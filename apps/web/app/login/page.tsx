"use client";

import { login, sendOtp, signup, verifyOtp } from "@/lib/authApi";
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
      queueToast("Account created! Welcome to AURA", "success");
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
          alt="AURA wallpaper"
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
              ← Back to AURA
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
                {step === 1 && (mode === "login" ? "Welcome back" : "Join AURA")}
                {step === 2 && "Check your inbox"}
                {step === 3 && "Almost there"}
              </h2>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                {step === 1 && mode === "login" && "Enter your email to continue"}
                {step === 1 && mode === "signup" && "Create your account to get started"}
                {step === 2 && (
                  <>We sent a code to <span style={{ color: "var(--text-primary)" }}>{email}</span></>
                )}
                {step === 3 && "Set up your profile to finish"}
              </p>
            </div>

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
                <div
                  className="flex rounded-lg p-0.5"
                  style={{ background: "var(--bg-elevated)" }}
                >
                  {(["login", "signup"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => { setMode(m); setError(""); }}
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

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 rounded-lg text-sm transition-all"
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                  onKeyDown={(e) => e.key === "Enter" && handleSendOTP()}
                />

                <button
                  onClick={handleSendOTP}
                  disabled={loading || !email}
                  className="w-full py-3 rounded-lg text-sm font-medium tracking-wide transition-opacity hover:opacity-80 disabled:opacity-40 mt-1"
                  style={{
                    background: "var(--accent)",
                    color: "var(--bg-primary)",
                  }}
                >
                  {loading ? "Sending..." : "Continue"}
                </button>
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
                animation: "aura-slide 1.2s ease-in-out infinite",
              }}
            />
          </div>

          <p
            className="text-xs tracking-[0.3em] uppercase"
            style={{ color: "var(--text-muted)" }}
          >
            Entering AURA
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