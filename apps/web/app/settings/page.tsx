"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  confirmPasswordChange,
  deleteAccount,
  getInterests,
  getProfile,
  sendDeleteAccountCode,
  verifyCurrentPassword,
  type Interest,
  type ProfileUser,
} from "@/lib/profileApi";
import { forgotPassword, resetPassword } from "@/lib/authApi";
import { useAuth } from "@/lib/authContext";
import { useToast } from "@/lib/toast";
import { ArrowLeftIcon, KeyIcon, MailIcon, ShieldIcon, StarIcon } from "lucide-react";

const INPUT =
  "w-full h-12 px-3.5 rounded-xl text-[15px] bg-[#151515] border border-white/[0.08] outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[#6f6f6f] focus:border-[color:var(--accent)] focus:shadow-[0_0_0_4px_var(--accent-muted)]";
const BTN = "h-10 px-4 rounded-full text-[13px] font-medium border border-white/[0.14] whitespace-nowrap transition-colors hover:bg-white/[0.05] disabled:opacity-40";
const PRIMARY = "h-11 px-5 rounded-full text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40";

type PwStep = "idle" | "verify" | "confirm";

function Row({ icon, title, sub, right, children }: { icon: React.ReactNode; title: string; sub: React.ReactNode; right?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="px-5 sm:px-6 py-5 [&+&]:border-t border-white/[0.06]">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#1a1a1a", color: "#d4d4d4" }}>{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-medium">{title}</p>
          <p className="text-[13px] mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</p>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

const Pill = ({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "soon" }) => (
  <span
    className="h-[26px] px-2.5 rounded-full text-xs font-medium flex items-center whitespace-nowrap"
    style={
      tone === "good"
        ? { background: "var(--accent-muted)", color: "var(--accent)" }
        : tone === "soon"
          ? { border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-muted)" }
          : { background: "rgba(255,255,255,0.06)", color: "#cfcfcf" }
    }
  >
    {children}
  </span>
);

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user: authUser, setUser: setAuthUser, loaded: authLoaded, refreshUser } = useAuth();
  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [interests, setInterests] = useState<Interest[] | null>(null);

  // password
  const [pwStep, setPwStep] = useState<PwStep>("idle");
  const [currentPw, setCurrentPw] = useState("");
  const [otp, setOtp] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  // delete
  const [delOpen, setDelOpen] = useState(false);
  const [delPw, setDelPw] = useState("");
  const [delOtp, setDelOtp] = useState("");
  const [delCodeSent, setDelCodeSent] = useState(false);
  const [delConfirm, setDelConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!authLoaded) return;
    if (!authUser) {
      router.push("/login?next=%2Fsettings");
      return;
    }
    getProfile()
      .then(setProfile)
      .catch((err: unknown) => toast(err instanceof Error ? err.message : "Failed to load settings", "error"))
      .finally(() => setLoading(false));
    getInterests().then(setInterests).catch(() => setInterests([]));
  }, [authLoaded, authUser, router, toast]);

  const noPassword = profile?.hasPassword === false;

  const resetPwForm = () => { setPwStep("idle"); setCurrentPw(""); setOtp(""); setNewPw(""); setConfirmPw(""); };

  async function startPasswordFlow() {
    if (!profile) return;
    if (!noPassword) { setPwStep("verify"); return; }
    // Google-only accounts: email a code, then set a password with it.
    setPwLoading(true);
    try {
      await forgotPassword(profile.email);
      setPwStep("confirm");
      toast("Code sent to your email.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to send code.", "error");
    } finally {
      setPwLoading(false);
    }
  }

  async function verifyPassword() {
    if (!currentPw) return;
    setPwLoading(true);
    try {
      await verifyCurrentPassword(currentPw);
      setPwStep("confirm");
      toast("Code sent to your email.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to verify password.", "error");
    } finally {
      setPwLoading(false);
    }
  }

  async function savePassword() {
    if (newPw.length < 8) { toast("New password must be at least 8 characters.", "error"); return; }
    if (newPw !== confirmPw) { toast("Passwords do not match.", "error"); return; }
    if (!profile) return;
    setPwLoading(true);
    try {
      if (noPassword) {
        await resetPassword({ email: profile.email, otp, newPassword: newPw });
        setProfile({ ...profile, hasPassword: true });
      } else {
        await confirmPasswordChange(otp, newPw);
      }
      toast(noPassword ? "Password set. You can now also sign in with email and password." : "Password changed.");
      resetPwForm();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save password.", "error");
    } finally {
      setPwLoading(false);
    }
  }

  async function sendDeleteCode() {
    try {
      await sendDeleteAccountCode();
      setDelCodeSent(true);
      toast("Code sent to your email.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to send code.", "error");
    }
  }

  async function confirmDelete() {
    if (delConfirm !== "DELETE") { toast('Type "DELETE" to confirm.', "error"); return; }
    if (!noPassword && !delPw) { toast("Password is required.", "error"); return; }
    if (delOtp.length !== 6) { toast("Enter the 6-digit code from your email.", "error"); return; }
    setDeleting(true);
    try {
      await deleteAccount(noPassword ? { otp: delOtp } : { password: delPw, otp: delOtp });
      setAuthUser(null);
      await refreshUser();
      router.push("/");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete account.", "error");
      setDeleting(false);
    }
  }

  const mismatch = confirmPw.length > 0 && newPw.length > 0 && confirmPw.length >= newPw.length && confirmPw !== newPw;

  return (
    <main className="min-h-screen pt-16" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <div className="max-w-[820px] mx-auto px-6 sm:px-12 pt-10 pb-20">
        <Link href="/profile" className="inline-flex items-center gap-2 min-h-11 text-[13px] transition-opacity hover:opacity-70" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeftIcon size={14} strokeWidth={2} aria-hidden="true" />
          Back to profile
        </Link>
        <h1 className="mt-2 mb-8 text-[44px] sm:text-[48px] leading-none" style={{ fontFamily: "var(--font-serif), serif" }}>Account settings</h1>

        {loading || !profile ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: "var(--bg-elevated)" }} />)}
          </div>
        ) : (
          <div>
            <div className="flex flex-col gap-7">
              {/* ── interests ── */}
              <section id="interests" aria-labelledby="h-interests" className="flex flex-col gap-3 scroll-mt-24">
                <h2 id="h-interests" className="text-[13px] font-medium tracking-[0.14em] uppercase" style={{ color: "var(--text-muted)" }}>Your feed</h2>
                <div className="rounded-[20px] overflow-hidden" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <Row
                    icon={<StarIcon size={18} strokeWidth={2} aria-hidden="true" />}
                    title="Interests"
                    sub={interests && interests.length ? "Categories you love — used to shape your home feed" : "Pick up to 4 categories to shape your home feed"}
                    right={
                      <Link href="/welcome?mode=edit&next=%2Fsettings" className={`${BTN} flex items-center`}>
                        {interests && interests.length ? "Edit" : "Pick interests"}
                      </Link>
                    }
                  >
                    {interests && interests.length > 0 && (
                      <div className="mt-4 sm:pl-14 flex flex-wrap gap-2">
                        {interests.map((i) => (
                          <span key={i.id} className="h-9 pl-1 pr-3 rounded-full flex items-center gap-2 text-[13px] font-medium" style={{ background: "#161616", border: "1px solid rgba(255,255,255,0.1)" }}>
                            {i.coverThumbUrl || i.coverImageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={(i.coverThumbUrl || i.coverImageUrl)!} alt="" className="w-7 h-7 rounded-full object-cover" />
                            ) : (
                              <span className="w-7 h-7 rounded-full" style={{ background: "#222" }} />
                            )}
                            {i.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </Row>
                </div>
              </section>

              {/* ── sign-in methods ── */}
              <section id="sign-in" aria-labelledby="h-sign-in" className="flex flex-col gap-3 scroll-mt-24">
                <h2 id="h-sign-in" className="text-[13px] font-medium tracking-[0.14em] uppercase" style={{ color: "var(--text-muted)" }}>Sign-in methods</h2>
                <div className="rounded-[20px] overflow-hidden" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <Row
                    icon={<MailIcon size={18} strokeWidth={2} aria-hidden="true" />}
                    title="Email"
                    sub={<><span style={{ color: "#d4d4d4" }}>{profile.email}</span> · you can always sign in with an emailed code</>}
                    right={<Pill tone="good">Verified</Pill>}
                  />
                  <Row
                    icon={
                      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
                    }
                    title="Google"
                    sub={profile.googleLinked ? "Connected — sign in with one tap" : `Sign in with Google using ${profile.email} to connect it`}
                    right={<Pill tone={profile.googleLinked ? "neutral" : "soon"}>{profile.googleLinked ? "Connected" : "Not connected"}</Pill>}
                  />
                  <Row
                    icon={<KeyIcon size={18} strokeWidth={2} aria-hidden="true" />}
                    title="Password"
                    sub={noPassword ? "Not set — add one to also sign in with email and password" : "Set — sign in with email and password"}
                    right={
                      pwStep === "idle" ? (
                        <button type="button" onClick={startPasswordFlow} disabled={pwLoading} className={BTN}>
                          {pwLoading ? "Sending code…" : noPassword ? "Set a password" : "Change password"}
                        </button>
                      ) : undefined
                    }
                  >
                    {pwStep === "verify" && (
                      <div className="mt-5 sm:pl-14 flex flex-col gap-3 max-w-[460px]">
                        <label htmlFor="pw-current" className="text-[13px]" style={{ color: "#c9c9c9" }}>Current password</label>
                        <input id="pw-current" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} autoComplete="current-password" className={INPUT} onKeyDown={(e) => e.key === "Enter" && verifyPassword()} autoFocus />
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>We’ll email you a code to confirm the change.</p>
                        <div className="flex gap-2.5 mt-1">
                          <button type="button" onClick={resetPwForm} className={BTN + " h-11"}>Cancel</button>
                          <button type="button" onClick={verifyPassword} disabled={pwLoading || !currentPw} className={PRIMARY} style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>
                            {pwLoading ? "Checking…" : "Continue"}
                          </button>
                        </div>
                      </div>
                    )}
                    {pwStep === "confirm" && (
                      <div className="mt-5 sm:pl-14 flex flex-col gap-3 max-w-[460px]">
                        <label htmlFor="pw-otp" className="text-[13px]" style={{ color: "#c9c9c9" }}>6-digit code from your email</label>
                        <input id="pw-otp" inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} className={INPUT + " tracking-[0.4em] text-center"} autoFocus />
                        <label htmlFor="pw-new" className="text-[13px] mt-1" style={{ color: "#c9c9c9" }}>New password</label>
                        <input id="pw-new" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" className={INPUT} />
                        <label htmlFor="pw-confirm" className="text-[13px] mt-1" style={{ color: "#c9c9c9" }}>Confirm new password</label>
                        <input
                          id="pw-confirm"
                          type="password"
                          value={confirmPw}
                          onChange={(e) => setConfirmPw(e.target.value)}
                          autoComplete="new-password"
                          className={INPUT}
                          style={confirmPw && newPw && confirmPw === newPw ? { borderColor: "#40C057" } : mismatch ? { borderColor: "#ef4444" } : undefined}
                        />
                        {mismatch && <p className="text-xs" style={{ color: "#f87171" }}>Passwords do not match</p>}
                        <div className="flex gap-2.5 mt-1">
                          <button type="button" onClick={resetPwForm} className={BTN + " h-11"}>Cancel</button>
                          <button
                            type="button"
                            onClick={savePassword}
                            disabled={pwLoading || otp.length !== 6 || newPw.length < 8 || newPw !== confirmPw}
                            className={PRIMARY}
                            style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
                          >
                            {pwLoading ? "Saving…" : noPassword ? "Set password" : "Update password"}
                          </button>
                        </div>
                      </div>
                    )}
                  </Row>
                </div>
              </section>

              {/* ── extra security ── */}
              <section aria-labelledby="h-security" className="flex flex-col gap-3">
                <h2 id="h-security" className="text-[13px] font-medium tracking-[0.14em] uppercase" style={{ color: "var(--text-muted)" }}>Extra security</h2>
                <div className="rounded-[20px] overflow-hidden" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <Row
                    icon={<ShieldIcon size={18} strokeWidth={2} aria-hidden="true" />}
                    title="Two-factor authentication"
                    sub="A second step when you sign in"
                    right={<Pill tone="soon">Coming soon</Pill>}
                  />
                </div>
              </section>

              {/* ── danger zone ── */}
              <section id="delete" aria-labelledby="h-delete" className="flex flex-col gap-3 scroll-mt-24">
                <h2 id="h-delete" className="text-[13px] font-medium tracking-[0.14em] uppercase" style={{ color: "#f87171" }}>Danger zone</h2>
                <div className="rounded-[20px] px-5 sm:px-6 py-5" style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.25)" }}>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex-[1_1_320px] min-w-0">
                      <p className="text-[15px] font-medium">Delete account</p>
                      <p className="text-[13px] mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                        Permanently removes your profile, likes, collections and uploads. We’ll email you a code to confirm. This can’t be undone.
                      </p>
                    </div>
                    {!delOpen && (
                      <button type="button" onClick={() => setDelOpen(true)} className={BTN} style={{ borderColor: "rgba(239,68,68,0.5)", color: "#f87171" }}>
                        Delete account…
                      </button>
                    )}
                  </div>

                  {delOpen && (
                    <div className="mt-5 flex flex-col gap-3 max-w-[460px]">
                      {!noPassword && (
                        <>
                          <label htmlFor="del-pw" className="text-[13px]" style={{ color: "#c9c9c9" }}>Your password</label>
                          <input id="del-pw" type="password" value={delPw} onChange={(e) => setDelPw(e.target.value)} autoComplete="current-password" className={INPUT} />
                        </>
                      )}
                      {delCodeSent ? (
                        <>
                          <label htmlFor="del-otp" className="text-[13px]" style={{ color: "#c9c9c9" }}>6-digit code from your email</label>
                          <input id="del-otp" inputMode="numeric" autoComplete="one-time-code" value={delOtp} onChange={(e) => setDelOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} className={INPUT + " tracking-[0.4em] text-center"} />
                        </>
                      ) : (
                        <button type="button" onClick={sendDeleteCode} className={BTN + " h-11"}>Email me a confirmation code</button>
                      )}
                      <label htmlFor="del-confirm" className="text-[13px] mt-1" style={{ color: "#c9c9c9" }}>Type DELETE to confirm</label>
                      <input id="del-confirm" value={delConfirm} onChange={(e) => setDelConfirm(e.target.value)} className={INPUT} style={delConfirm === "DELETE" ? { borderColor: "#ef4444" } : undefined} />
                      <div className="flex gap-2.5 mt-1">
                        <button type="button" onClick={() => { setDelOpen(false); setDelPw(""); setDelOtp(""); setDelConfirm(""); }} className={BTN + " h-11"}>Cancel</button>
                        <button
                          type="button"
                          onClick={confirmDelete}
                          disabled={deleting || (!noPassword && !delPw) || delOtp.length !== 6 || delConfirm !== "DELETE"}
                          className={PRIMARY}
                          style={{ background: "#ef4444", color: "#fff" }}
                        >
                          {deleting ? "Deleting account…" : "Delete my account"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
