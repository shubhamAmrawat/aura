"use client";

import { forgotPassword, login, loginWithGoogle, loginWithPassword, resetPassword, sendOtp, signup, verifyOtp, verifyResetCode } from "@/lib/authApi";
import GoogleSignIn from "@/app/components/GoogleSignIn";
import { queueToast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
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

/* ── Hero: featured wallpapers that cross-fade (bundled in /public/auth, ~1920px webp) ── */
const HEROES = [
  { src: "/auth/snow.webp", title: "Majestic Snow-Capped Mountain at Sunrise", category: "Mountains", id: "d76729fb-edc4-4d0b-a994-936478528e0c", position: "50% 50%" },
  { src: "/auth/dusk.webp", title: "Contemplation at Dusk", category: "Sunset", id: "3501f5f8-0e3d-4ffb-b4b7-27f9b2ff57f7", position: "86% 50%" },
  { src: "/auth/ocean.webp", title: "An aerial view of the ocean and the beach", category: "Ocean", id: "49f68ff9-d8a2-4030-883d-8d605f870ce5", position: "50% 50%" },
  { src: "/auth/peaks.webp", title: "Crimson Peaks: A Surreal Mountain Landscape", category: "Mountains", id: "5975806b-cf18-4aa3-bed7-0e6cafae30b5", position: "50% 50%" },
];
const HERO_INTERVAL_MS = 7000;
// Width of the soft edge where the wallpaper fades into the page, as % of the image panel.
// Bigger = wider, softer fade; smaller = shorter, crisper edge. (Try 20–45.)
const HERO_FADE_PERCENT = 5;
// Smoothstep-eased mask: fully visible until the fade starts, then eases out to transparent.
const HERO_MASK = (() => {
  const start = 100 - HERO_FADE_PERCENT;
  const stops = Array.from({ length: 11 }, (_, k) => {
    const t = k / 10;
    const alpha = 1 - t * t * (3 - 2 * t);
    return `rgba(0,0,0,${alpha.toFixed(3)}) ${(start + t * HERO_FADE_PERCENT).toFixed(2)}%`;
  });
  return `linear-gradient(90deg, #000 0%, ${stops.join(", ")})`;
})();

const CheckIcon = ({ size = 16, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12l5 5L20 7" />
  </svg>
);

const ArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

function AuthHero({ mode }: { mode: "login" | "signup" }) {
  const [index, setIndex] = useState(0);

  // Restart the timer whenever the slide changes (also after a dot click).
  useEffect(() => {
    const id = setTimeout(() => setIndex((i) => (i + 1) % HEROES.length), HERO_INTERVAL_MS);
    return () => clearTimeout(id);
  }, [index]);

  const current = HEROES[index] ?? HEROES[0]!;

  return (
    <div className="hidden lg:flex relative w-[55%] flex-shrink-0 flex-col justify-between p-12 overflow-hidden">
      {/* Image layer fades into the page with an eased mask (no hard band at the edge). */}
      <div className="absolute inset-0" style={{ WebkitMaskImage: HERO_MASK, maskImage: HERO_MASK }}>
        {HEROES.map((h, i) => (
          <Image
            key={h.src}
            src={h.src}
            alt=""
            fill
            priority={i === 0}
            sizes="55vw"
            className="object-cover ease-out motion-reduce:!transition-none"
            style={{
              objectPosition: h.position,
              opacity: i === index ? 1 : 0,
              transform: i === index ? "scale(1)" : "scale(1.06)",
              transitionProperty: "opacity, transform",
              transitionDuration: "1400ms, 9000ms",
            }}
          />
        ))}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(8,8,8,0.4) 0%, rgba(8,8,8,0) 28%, rgba(8,8,8,0) 50%, rgba(8,8,8,0.88) 100%)" }}
        />
      </div>

      <div className="relative z-10">
        <Logo href="/" />
      </div>

      <div className="relative z-10 flex flex-col gap-6 max-w-[540px]">
        <p className="text-[44px] leading-[1.08] tracking-[-0.01em]" style={{ fontFamily: "var(--font-serif), serif", color: "var(--text-primary)" }}>
          {mode === "login" ? "Wallpapers worth" : "Start a collection"}
          <br />
          <span className="italic" style={{ color: "#cfe9c0" }}>
            {mode === "login" ? "looking at twice." : "that’s all yours."}
          </span>
        </p>

        {mode === "signup" && (
          <ul className="flex flex-col gap-3 text-sm" style={{ color: "#d6d6d6" }}>
            {["Like and save wallpapers into collections", "One account for the website and the Android app", "Free, in full quality"].map((t) => (
              <li key={t} className="flex items-center gap-2.5">
                <CheckIcon color="var(--accent)" />
                {t}
              </li>
            ))}
          </ul>
        )}

        <Link
          href={`/wallpaper/${current.id}`}
          className="self-start flex items-center gap-3.5 rounded-2xl py-2.5 pl-2.5 pr-4 transition-colors hover:bg-black/60"
          style={{ background: "rgba(12,12,12,0.55)", border: "1px solid rgba(255,255,255,0.10)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}
        >
          <span className="relative w-11 h-11 rounded-[9px] overflow-hidden flex-shrink-0">
            <Image src={current.src} alt="" fill sizes="44px" className="object-cover" style={{ objectPosition: current.position }} />
          </span>
          <span key={current.id} className="flex flex-col gap-0.5 min-w-0" style={{ animation: "auth-in 0.6s ease-out" }}>
            <span className="text-[11px] tracking-[0.14em] uppercase" style={{ color: "#a3a3a3" }}>On this screen</span>
            <span className="text-sm font-medium truncate max-w-[300px]" style={{ color: "var(--text-primary)" }}>{current.title}</span>
          </span>
          <span className="ml-2 text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.08)", color: "#d8d8d8" }}>
            {current.category}
          </span>
        </Link>

        <div className="flex items-center gap-1.5">
          {HEROES.map((h, i) => (
            <button
              key={h.src}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show wallpaper ${i + 1} of ${HEROES.length}`}
              aria-current={i === index}
              className="h-6 flex items-center"
            >
              <span
                className="block h-[3px] rounded-full transition-all duration-500"
                style={{ width: i === index ? 28 : 12, background: i === index ? "var(--text-primary)" : "rgba(255,255,255,0.3)" }}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Six boxes over one real input: paste, SMS/email autofill and backspace all work natively. */
function CodeInput({ value, onChange, onComplete }: { value: string; onChange: (v: string) => void; onComplete?: (v: string) => void }) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="relative">
      <div className="grid grid-cols-6 gap-2.5" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => {
          const active = focused && (i === value.length || (value.length === 6 && i === 5));
          return (
            <div
              key={i}
              className="h-[60px] rounded-xl flex items-center justify-center text-2xl font-medium tabular-nums transition-[border-color,box-shadow] duration-150"
              style={{
                background: "#141414",
                color: "var(--text-primary)",
                border: `1px solid ${active ? "var(--accent)" : value[i] ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)"}`,
                boxShadow: active ? "0 0 0 4px var(--accent-muted)" : "none",
              }}
            >
              {value[i] ?? ""}
            </div>
          );
        })}
      </div>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label="6-digit code"
        maxLength={6}
        value={value}
        autoFocus
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 6);
          onChange(v);
          if (v.length === 6 && value.length !== 6) onComplete?.(v);
        }}
        onKeyDown={(e) => e.key === "Enter" && value.length === 6 && onComplete?.(value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-text"
        style={{ caretColor: "transparent" }}
      />
    </div>
  );
}

/** 0–4: length 8+, length 12+, mixed case, a digit or symbol. */
function passwordScore(p: string) {
  if (p.length < 8) return 0;
  return [true, p.length >= 12, /[a-z]/.test(p) && /[A-Z]/.test(p), /[\d\W_]/.test(p)].filter(Boolean).length;
}
const SCORE_LABEL = ["Too short", "Weak", "Okay", "Good", "Strong"];

const RESEND_COOLDOWN_S = 30;

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<"login" | "signup">(searchParams.get("mode") === "signup" ? "signup" : "login");
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
  // Seconds until "Resend code" is available again.
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);
  // Live email validation (same rule as the API)
  const [emailTouched, setEmailTouched] = useState(false);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const showEmailError = email.length > 0 && !emailValid && emailTouched;
  const resetFlow = mode === "login" && (view === "forgot" || view === "code" || view === "reset");

  const goTo = (v: typeof view) => { setView(v); setStep(1); setError(""); setInfo(""); setOtp(""); };

  /** After login: admins always land on /admin; everyone else on ?next= or /. */
  const finishLogin = async (message: string, role?: string) => {
    await refreshUser();
    queueToast(message, "success");
    setNavigating(true);
    router.push(role === "admin" ? "/admin" : next ? decodeURIComponent(next) : "/");
  };

  const handleGoogle = async (credential: string) => {
    setLoading(true);
    setError("");
    try {
      const { isNewUser, user } = await loginWithGoogle(credential);
      await finishLogin(isNewUser ? "Account created! Welcome to Aurora" : "Welcome back!", user?.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
      setLoading(false);
    }
  };

  const handlePasswordLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await loginWithPassword({ email, password: loginPassword });
      await finishLogin("Welcome back!", res.user?.role);
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
      setCooldown(RESEND_COOLDOWN_S);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyResetCode = async (code: string = resetCode) => {
    setLoading(true);
    setError("");
    try {
      await verifyResetCode({ email, otp: code });
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
      const res = await loginWithPassword({ email, password: newPassword });
      await finishLogin("Password updated. Welcome back!", res.user?.role);
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
      setOtp("");
      setStep(2);
      setCooldown(RESEND_COOLDOWN_S);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (code: string = otp) => {
    setLoading(true);
    setError("");
    try {
      await verifyOtp({ email, code, type: mode });
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
      const res = await login({ email });
      await finishLogin("Welcome back!", res.user?.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  const INPUT =
    "w-full h-[52px] px-4 rounded-xl text-[15px] bg-[#141414] border border-white/[0.08] outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[#7a7a7a] focus:border-[color:var(--accent)] focus:shadow-[0_0_0_4px_var(--accent-muted)]";
  const PRIMARY =
    "w-full h-[52px] rounded-full text-[15px] font-semibold flex items-center justify-center gap-2.5 transition-[opacity,transform] duration-150 hover:opacity-90 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100";
  const SECONDARY =
    "w-full h-12 rounded-full text-sm font-medium border border-white/10 transition-colors hover:bg-white/[0.04] disabled:opacity-40";
  const LABEL = "text-[13px]";
  const primaryStyle = { background: "var(--accent)", color: "var(--bg-primary)" };
  const textStyle = { color: "var(--text-primary)" };
  const labelStyle = { color: "#c9c9c9" };
  const mutedStyle = { color: "var(--text-secondary)" };

  const codeStep = step === 2 || (mode === "login" && view === "code");
  const showGoogle = step === 1 && (mode === "signup" || view === "password" || view === "otp");
  const showSwitch = step === 1 && !resetFlow;
  const score = passwordScore(password);

  const switchMode = (m: "login" | "signup") => {
    setMode(m);
    setStep(1);
    setError("");
    setInfo("");
    setOtp("");
    if (m === "login") setView("password");
  };

  const heading = resetFlow
    ? view === "forgot" ? "Reset your password" : view === "code" ? "Check your inbox" : "Choose a new password"
    : step === 2 ? "Check your inbox"
    : step === 3 ? "Make it yours"
    : mode === "signup" ? "Create your account"
    : view === "otp" ? "Sign in with a code"
    : "Sign in to your collection";

  const passwordToggle = (shown: boolean, toggle: () => void) => (
    <button
      type="button"
      onClick={toggle}
      className="absolute right-1 top-1 w-11 h-11 flex items-center justify-center transition-opacity hover:opacity-60"
      style={{ color: "var(--text-muted)" }}
      tabIndex={-1}
      aria-label={shown ? "Hide password" : "Show password"}
    >
      {shown ? <EyeOffIcon /> : <EyeIcon />}
    </button>
  );

  const resendButton = (onResend: () => void) => (
    <button
      type="button"
      onClick={onResend}
      disabled={loading || cooldown > 0}
      className="text-sm font-medium px-1 min-h-11 transition-opacity hover:opacity-70 disabled:hover:opacity-100"
      style={{ color: cooldown > 0 ? "var(--text-muted)" : "var(--accent)" }}
    >
      {cooldown > 0 ? `Resend in 0:${String(cooldown).padStart(2, "0")}` : "Resend code"}
    </button>
  );

  return (
    <main className="min-h-screen flex" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <AuthHero mode={mode} />

      {/* ── form panel ── */}
      <div className="flex-1 flex flex-col min-h-screen px-6 sm:px-12 py-6">
        <div className="flex items-center justify-between min-h-11">
          <div className="lg:hidden">
            <Logo href="/" />
          </div>
          <Link
            href="/"
            className="ml-auto inline-flex items-center gap-2 min-h-11 text-[13px] transition-opacity hover:opacity-70"
            style={mutedStyle}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M19 12H5M11 6l-6 6 6 6" />
            </svg>
            Back to Aurora
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center py-10">
          <div className="w-full max-w-[384px]">
            {/* sign-up progress */}
            {mode === "signup" && (
              <div className="flex items-center gap-3 mb-8">
                <div className="flex-1 grid grid-cols-3 gap-1.5" aria-hidden="true">
                  {[1, 2, 3].map((s) => (
                    <span
                      key={s}
                      className="h-[3px] rounded-full transition-colors duration-500"
                      style={{ background: s <= step ? "var(--accent)" : "#262626" }}
                    />
                  ))}
                </div>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Step {step} of 3</span>
              </div>
            )}

            {/* heading */}
            <div key={`${mode}-${step}-${view}`} className="mb-8" style={{ animation: "auth-in 0.35s ease-out" }}>
              {codeStep && (
                <div
                  className="w-[52px] h-[52px] rounded-[14px] flex items-center justify-center mb-6"
                  style={{ background: "var(--accent-muted)", border: "1px solid rgba(129,238,78,0.25)" }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="M3 7l9 6 9-6" />
                  </svg>
                </div>
              )}
              {mode === "login" && step === 1 && (view === "password" || view === "otp") && (
                <p className="text-xs tracking-[0.18em] uppercase mb-3.5" style={{ color: "var(--accent)" }}>Welcome back</p>
              )}
              <h1 className="text-[44px] leading-[1.04] tracking-[-0.01em] mb-2.5" style={{ fontFamily: "var(--font-serif), serif" }}>
                {heading}
              </h1>
              <p className="text-[15px] leading-relaxed" style={mutedStyle}>
                {resetFlow && view === "forgot" && "Enter your email and we’ll send you a code."}
                {resetFlow && view === "code" && (
                  <>Enter the 6-digit code sent to <span style={textStyle}>{email}</span>.</>
                )}
                {resetFlow && view === "reset" && (
                  <>Set a new password for <span style={textStyle}>{email}</span>.</>
                )}
                {!resetFlow && step === 1 && mode === "login" && view === "password" && "Your likes and collections, on the web and in the Android app."}
                {!resetFlow && step === 1 && mode === "login" && view === "otp" && "We’ll email you a 6-digit code. No password needed."}
                {!resetFlow && step === 1 && mode === "signup" && "It takes under a minute. We’ll send a code to confirm your email."}
                {!resetFlow && step === 2 && (
                  <>Enter the 6-digit code we sent to <span style={textStyle}>{email}</span>.</>
                )}
                {!resetFlow && step === 3 && "Choose how you appear on Aurora. You can change this later."}
              </p>
            </div>

            {info && !error && (
              <p className="text-sm mb-5" style={mutedStyle}>{info}</p>
            )}
            {error && (
              <p
                role="alert"
                className="text-sm mb-5 px-3.5 py-2.5 rounded-xl"
                style={{ color: "#f87171", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)" }}
              >
                {error}
              </p>
            )}

            {/* ── STEP 1 ── */}
            {step === 1 && (
              <div className="flex flex-col">
                {showGoogle && (
                  <>
                    <GoogleSignIn
                      key={mode}
                      theme="outline"
                      context={mode === "signup" ? "signup" : "signin"}
                      onCredential={handleGoogle}
                    />
                    <div className="flex items-center gap-3.5 my-6">
                      <span className="h-px flex-1 bg-white/[0.08]" />
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>or with email</span>
                      <span className="h-px flex-1 bg-white/[0.08]" />
                    </div>
                  </>
                )}

                {!(mode === "login" && (view === "code" || view === "reset")) && (
                  <div className="flex flex-col gap-2">
                    <label htmlFor="auth-email" className={LABEL} style={labelStyle}>Email</label>
                    <input
                      id="auth-email"
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value.trim()); setError(""); }}
                      placeholder="you@example.com"
                      autoComplete="email"
                      className={INPUT}
                      style={showEmailError ? { borderColor: "#ef4444" } : undefined}
                      onBlur={() => setEmailTouched(true)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        setEmailTouched(true);
                        if (!emailValid) return;
                        if (mode === "signup" || view === "otp") handleSendOTP();
                        else if (view === "forgot") handleForgot();
                      }}
                    />
                    {showEmailError && (
                      <p className="text-xs" style={{ color: "#f87171" }}>Enter a valid email address</p>
                    )}
                  </div>
                )}

                {/* Sign in with password (default) */}
                {mode === "login" && view === "password" && (
                  <>
                    <div className="flex flex-col gap-2 mt-[18px]">
                      <div className="flex items-baseline justify-between">
                        <label htmlFor="auth-password" className={LABEL} style={labelStyle}>Password</label>
                        <button type="button" onClick={() => goTo("forgot")} className="text-[13px] transition-opacity hover:opacity-70" style={mutedStyle}>
                          Forgot?
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          id="auth-password"
                          type={showLoginPassword ? "text" : "password"}
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          autoComplete="current-password"
                          className={`${INPUT} pr-[52px]`}
                          onKeyDown={(e) => e.key === "Enter" && emailValid && loginPassword && handlePasswordLogin()}
                        />
                        {passwordToggle(showLoginPassword, () => setShowLoginPassword((v) => !v))}
                      </div>
                    </div>
                    <button
                      onClick={handlePasswordLogin}
                      disabled={loading || !emailValid || !loginPassword}
                      className={`${PRIMARY} mt-[26px] cursor-pointer`}
                      style={primaryStyle}
                    >
                      {loading ? "Signing in…" : <>Sign in <ArrowIcon /></>}
                    </button>
                    <button onClick={() => goTo("otp")} className={`${SECONDARY} mt-2.5 cursor-pointer`} style={{ color: "#d8d8d8" }}>
                      Email me a sign-in code instead
                    </button>
                  </>
                )}

                {/* Sign in with an emailed code, or sign up */}
                {(mode === "signup" || view === "otp") && (
                  <>
                    <button
                      onClick={handleSendOTP}
                      disabled={loading || !emailValid}
                      className={`${PRIMARY} mt-[26px] cursor-pointer`}
                      style={primaryStyle}
                    >
                      {loading ? "Sending…" : <>{mode === "login" ? "Email me a code" : "Continue"} <ArrowIcon /></>}
                    </button>
                    {mode === "login" && (
                      <button onClick={() => goTo("password")} className={`${SECONDARY} mt-2.5`} style={{ color: "#d8d8d8" }}>
                        Use my password instead
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
                      className={`${PRIMARY} mt-[26px]`}
                      style={primaryStyle}
                    >
                      {loading ? "Sending…" : "Send reset code"}
                    </button>
                    <button onClick={() => goTo("password")} className={`${SECONDARY} mt-2.5`} style={{ color: "#d8d8d8" }}>
                      Back to sign in
                    </button>
                  </>
                )}

                {/* Forgot step 2: enter the emailed code */}
                {mode === "login" && view === "code" && (
                  <>
                    <CodeInput
                      value={resetCode}
                      onChange={setResetCode}
                      onComplete={(c) => !loading && handleVerifyResetCode(c)}
                    />
                    <button
                      onClick={() => handleVerifyResetCode()}
                      disabled={loading || resetCode.length !== 6}
                      className={`${PRIMARY} mt-[26px]`}
                      style={primaryStyle}
                    >
                      {loading ? "Verifying…" : "Verify code"}
                    </button>
                    <div className="flex items-center justify-between mt-3">
                      <button onClick={() => goTo("forgot")} className="text-sm min-h-11 transition-opacity hover:opacity-70" style={mutedStyle}>
                        Change email
                      </button>
                      {resendButton(handleForgot)}
                    </div>
                  </>
                )}

                {/* Forgot step 3: new password (code already verified) */}
                {mode === "login" && view === "reset" && (
                  <>
                    <div className="flex flex-col gap-2">
                      <label htmlFor="auth-new-password" className={LABEL} style={labelStyle}>New password</label>
                      <div className="relative">
                        <input
                          id="auth-new-password"
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => { setNewPassword(e.target.value); setError(""); }}
                          placeholder="At least 8 characters"
                          autoComplete="new-password"
                          className={`${INPUT} pr-[52px]`}
                          style={newPasswordTooShort ? { borderColor: "#ef4444" } : undefined}
                        />
                        {passwordToggle(showNewPassword, () => setShowNewPassword((v) => !v))}
                      </div>
                      {newPasswordTooShort && (
                        <p className="text-xs" style={{ color: "#f87171" }}>At least 8 characters ({8 - newPassword.length} more)</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 mt-[18px]">
                      <label htmlFor="auth-new-confirm" className={LABEL} style={labelStyle}>Confirm new password</label>
                      <div className="relative">
                        <input
                          id="auth-new-confirm"
                          type={showConfirmNewPassword ? "text" : "password"}
                          value={confirmNewPassword}
                          onChange={(e) => { setConfirmNewPassword(e.target.value); setError(""); }}
                          onBlur={() => setConfirmNewTouched(true)}
                          autoComplete="new-password"
                          className={`${INPUT} pr-[84px]`}
                          style={
                            confirmNewPassword && newPasswordsMatch ? { borderColor: "#40C057" }
                            : showNewMismatch ? { borderColor: "#ef4444" }
                            : undefined
                          }
                          onKeyDown={(e) => e.key === "Enter" && newPasswordsMatch && handleReset()}
                        />
                        {confirmNewPassword && newPasswordsMatch && (
                          <span className="absolute right-12 top-1/2 -translate-y-1/2"><CheckIcon color="#40C057" /></span>
                        )}
                        {passwordToggle(showConfirmNewPassword, () => setShowConfirmNewPassword((v) => !v))}
                      </div>
                      {showNewMismatch && (
                        <p className="text-xs" style={{ color: "#f87171" }}>Passwords do not match</p>
                      )}
                    </div>
                    <button
                      onClick={handleReset}
                      disabled={loading || !newPasswordsMatch}
                      className={`${PRIMARY} mt-[26px]`}
                      style={primaryStyle}
                    >
                      {loading ? "Saving…" : "Set new password"}
                    </button>
                    <button onClick={() => goTo("forgot")} className={`${SECONDARY} mt-2.5`} style={{ color: "#d8d8d8" }}>
                      Start over
                    </button>
                  </>
                )}
              </div>
            )}

            {/* ── STEP 2: emailed code (sign-up, or sign-in with a code) ── */}
            {step === 2 && (
              <div className="flex flex-col">
                <CodeInput value={otp} onChange={setOtp} onComplete={(c) => !loading && handleVerifyOtp(c)} />
                <button
                  onClick={() => handleVerifyOtp()}
                  disabled={loading || otp.length !== 6}
                  className={`${PRIMARY} mt-[26px] cursor-pointer`}
                  style={primaryStyle}
                >
                  {loading ? "Verifying…" : mode === "signup" ? "Verify email" : "Sign in"}
                </button>
                <div className="flex items-center justify-between mt-3">
                  <button
                    onClick={() => { setStep(1); setOtp(""); setError(""); }}
                    className="text-sm min-h-11 transition-opacity hover:opacity-70"
                    style={mutedStyle}
                  >
                    Change email
                  </button>
                  {resendButton(handleSendOTP)}
                </div>
                <p className="text-xs mt-2 text-center" style={{ color: "var(--text-muted)" }}>
                  Check spam if it’s not in your inbox. The code expires in 15 minutes.
                </p>
              </div>
            )}

            {/* ── STEP 3: profile ── */}
            {step === 3 && (
              <div className="flex flex-col gap-[18px]">
                <div className="flex flex-col gap-2">
                  <label htmlFor="auth-name" className={LABEL} style={labelStyle}>Display name</label>
                  <input
                    id="auth-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                    className={INPUT}
                    autoFocus
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="auth-username" className={LABEL} style={labelStyle}>Username</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[15px]" style={{ color: "var(--text-muted)" }} aria-hidden="true">@</span>
                    <input
                      id="auth-username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
                      placeholder="username"
                      autoComplete="username"
                      className={`${INPUT} pl-[34px]`}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="auth-new-pass" className={LABEL} style={labelStyle}>Password</label>
                  <div className="relative">
                    <input
                      id="auth-new-pass"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      className={`${INPUT} pr-[52px]`}
                    />
                    {passwordToggle(showPassword, () => setShowPassword((v) => !v))}
                  </div>
                  {password.length > 0 && (
                    <>
                      <div className="grid grid-cols-4 gap-1.5 mt-1" aria-hidden="true">
                        {[1, 2, 3, 4].map((n) => (
                          <span
                            key={n}
                            className="h-[3px] rounded-full transition-colors duration-300"
                            style={{ background: n <= score ? (score <= 1 ? "#f59e0b" : "var(--accent)") : "#262626" }}
                          />
                        ))}
                      </div>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {SCORE_LABEL[score]}{password.length < 8 ? ` · ${8 - password.length} more characters` : ""}
                      </span>
                    </>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="auth-confirm" className={LABEL} style={labelStyle}>Confirm password</label>
                  <div className="relative">
                    <input
                      id="auth-confirm"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      className={`${INPUT} pr-[84px]`}
                      style={
                        confirmPassword && passwordsMatch ? { borderColor: "#40C057" }
                        : showMismatch ? { borderColor: "#ef4444" }
                        : undefined
                      }
                      onBlur={() => setConfirmTouched(true)}
                      onKeyDown={(e) => e.key === "Enter" && displayName && username && passwordsMatch && handleSignup()}
                    />
                    {confirmPassword && passwordsMatch && (
                      <span className="absolute right-12 top-1/2 -translate-y-1/2"><CheckIcon color="#40C057" /></span>
                    )}
                    {passwordToggle(showConfirmPassword, () => setShowConfirmPassword((v) => !v))}
                  </div>
                  {showMismatch && (
                    <p className="text-xs" style={{ color: "#f87171" }}>Passwords do not match</p>
                  )}
                </div>

                <button
                  onClick={handleSignup}
                  disabled={loading || !displayName || !username || !password || !confirmPassword}
                  className={`${PRIMARY} mt-2`}
                  style={primaryStyle}
                >
                  {loading ? "Creating account…" : "Create account"}
                </button>
              </div>
            )}

            {showSwitch && (
              <p className="mt-8 text-sm text-center" style={mutedStyle}>
                {mode === "login" ? "New to Aurora? " : "Already have an account? "}
                <button
                  type="button"
                  onClick={() => switchMode(mode === "login" ? "signup" : "login")}
                  className="font-medium underline underline-offset-4 decoration-white/30 hover:decoration-white/70 transition-colors cursor-pointer"
                  style={textStyle}
                >
                  {mode === "login" ? "Create an account" : "Sign in"}
                </button>
              </p>
            )}
          </div>
        </div>

        <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
          By continuing you agree to Aurora’s{" "}
          <Link href="/terms-of-service" className="underline underline-offset-2 hover:opacity-80" style={{ color: "#a8a8a8" }}>Terms</Link>
          {" "}and{" "}
          <Link href="/privacy-policy" className="underline underline-offset-2 hover:opacity-80" style={{ color: "#a8a8a8" }}>Privacy Policy</Link>.
        </p>
      </div>

      {navigating && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center flex-col gap-6"
          style={{ background: "var(--bg-primary)" }}
        >
          <Logo href="/" />
          <div className="relative h-[2px] rounded-full overflow-hidden" style={{ width: 120, background: "var(--border)" }}>
            <div
              className="absolute top-0 left-0 h-full rounded-full"
              style={{ width: "40%", background: "var(--accent)", animation: "aurora-slide 1.2s ease-in-out infinite" }}
            />
          </div>
          <p className="text-xs tracking-[0.3em] uppercase" style={{ color: "var(--text-muted)" }}>
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
