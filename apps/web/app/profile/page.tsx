"use client";

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { getUserCollections, type Collection } from "@/lib/collectionsApi";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import AvatarCropper from "@/app/components/AvatarCropper";
import {
  confirmAvatarUpload,
  confirmPasswordChange,
  deleteAccount,
  getAvatarUploadUrl,
  getProfile,
  type ProfileUser,
  updateProfile,
  uploadAvatarDirect,
  uploadAvatarToSignedUrl,
  uploadCoverDirect,
  verifyCurrentPassword,
} from "@/lib/profileApi";
import { useToast } from "@/lib/toast";
import { useAuth } from "@/lib/authContext";
import { getLikedWallpapers } from "@/lib/likesApi";
import { becomeCreator } from "@/lib/api";
import UserUploadsSection from "@/app/components/UserUploadsSection";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const MAX_COVER_BYTES = 10 * 1024 * 1024;

// ─── Icons ──────────────────────────────────────────────────
function IcUser() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-muted)", flexShrink: 0 }}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function IcAt() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-muted)", flexShrink: 0 }}>
      <circle cx="12" cy="12" r="4" /><path d="M16 8v5a2 2 0 1 0 4 0v-1a8 8 0 1 0-4 6.93" />
    </svg>
  );
}
function IcPhone() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-muted)", flexShrink: 0 }}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.99a16 16 0 0 0 6 6l1.53-1.23a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
function IcMail() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-muted)", flexShrink: 0 }}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
    </svg>
  );
}
function IcCamera() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
    </svg>
  );
}
function IcDownload() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
function IcUpload() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
function IcCalendar() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function IcLock() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-muted)", flexShrink: 0 }}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
function IcImage() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
    </svg>
  );
}
function IcShield() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-muted)", flexShrink: 0 }}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function IcChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ─── Helpers ─────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function FieldRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] tracking-widest uppercase mb-1.5" style={{ color: "var(--text-muted)" }}>{label}</p>
      <div className="flex items-center gap-2.5">
        {icon}
        {children}
      </div>
      <div className="mt-3" style={{ borderBottom: "1px solid var(--border)" }} />
    </div>
  );
}

function inputBase(active: boolean): React.CSSProperties {
  return {
    background: "transparent",
    color: active ? "var(--text-primary)" : "var(--text-secondary)",
    outline: "none",
    width: "100%",
    fontSize: "0.875rem",
    padding: 0,
    border: "none",
  };
}

type PwStep = "idle" | "verify" | "confirm";

function AvatarHoverButton({ avatarUrl, initials, uploading, onClick }: {
  avatarUrl: string | null;
  initials: string;
  uploading: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ cursor: "pointer" }}
      onClick={onClick}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt="Avatar"
          className="w-24 h-24 rounded-full object-cover"
          style={{ border: "3px solid var(--bg-primary)", boxShadow: "0 0 0 1px var(--border)" }}
        />
      ) : (
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold"
          style={{ background: "var(--accent)", color: "var(--bg-primary)", border: "3px solid var(--bg-primary)", boxShadow: "0 0 0 1px var(--border)" }}
        >
          {initials}
        </div>
      )}
      <div
        className="absolute inset-0 rounded-full flex items-center justify-center transition-opacity duration-200"
        style={{ background: "rgba(0,0,0,0.55)", opacity: hovered || uploading ? 1 : 0 }}
      >
        {uploading ? (
          <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} />
        ) : (
          <IcCamera />
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────
export default function ProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user: authUser, setUser: setAuthUser, loaded: authLoaded, refreshUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileUser | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftUsername, setDraftUsername] = useState("");
  const [draftBio, setDraftBio] = useState("");
  const [draftContact, setDraftContact] = useState("");
  const [saving, setSaving] = useState(false);

  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropMode, setCropMode] = useState<"avatar" | "cover">("avatar");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [bannerHovered, setBannerHovered] = useState(false);

  const [pwStep, setPwStep] = useState<PwStep>("idle");
  const [currentPw, setCurrentPw] = useState("");
  const [otp, setOtp] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  const [delPw, setDelPw] = useState("");
  const [delConfirm, setDelConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [becomingCreator, setBecomingCreator] = useState(false);

  // liked wallpapers
  const [likedWallpapers, setLikedWallpapers] = useState<any[]>([]);
  const [likedLoading, setLikedLoading] = useState(false);
  const [visibleRows, setVisibleRows] = useState(2);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const inputStyleBase: React.CSSProperties = {
    background: "var(--bg-elevated)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
    outline: "none",
    width: "100%",
    padding: "0.75rem 1rem",
    borderRadius: "0.5rem",
    fontSize: "0.875rem",
  };

  useEffect(() => {
    if (!authLoaded) return;
    if (!authUser) {
      router.push("/login");
      return;
    }

    getProfile()
      .then((p) => {
        setProfile(p);
        setDraftName(p.displayName ?? "");
        setDraftUsername(p.username ?? "");
        setDraftBio(p.bio ?? "");
        setDraftContact(p.contactNo ?? "");
      })
      .catch((err: unknown) => {
        toast(err instanceof Error ? err.message : "Failed to load profile", "error");
      })
      .finally(() => setLoading(false));

    // fetch liked wallpapers + collections in parallel
    setLikedLoading(true);
    getLikedWallpapers()
      .then(setLikedWallpapers)
      .catch(() => setLikedWallpapers([]))
      .finally(() => setLikedLoading(false));

    setCollectionsLoading(true);
    getUserCollections()
      .then(setCollections)
      .catch(() => setCollections([]))
      .finally(() => setCollectionsLoading(false));

  }, [authLoaded, authUser, router, toast]);

  const LIKED_COLS = 3;
  const visibleCount = visibleRows * LIKED_COLS;

  function openEdit() {
    if (!profile) return;
    setDraftName(profile.displayName ?? "");
    setDraftUsername(profile.username ?? "");
    setDraftBio(profile.bio ?? "");
    setDraftContact(profile.contactNo ?? "");
    setIsEditing(true);
  }

  function cancelEdit() {
    if (!profile) return;
    setDraftName(profile.displayName ?? "");
    setDraftUsername(profile.username ?? "");
    setDraftBio(profile.bio ?? "");
    setDraftContact(profile.contactNo ?? "");
    setIsEditing(false);
  }

  async function handleSave() {
    if (!profile || !authUser) return;
    if (!draftName.trim()) { toast("Display name is required.", "error"); return; }
    if (draftUsername.trim().length < 3) { toast("Username must be at least 3 characters.", "error"); return; }
    setSaving(true);
    try {
      const updated = await updateProfile({
        displayName: draftName.trim(),
        username: draftUsername.trim().toLowerCase(),
        bio: draftBio.trim(),
        contactNo: draftContact.trim(),
      });
      setProfile((prev) => prev ? { ...prev, ...updated } : updated);
      setDraftName(updated.displayName ?? "");
      setDraftUsername(updated.username ?? "");
      setDraftBio(updated.bio ?? "");
      setDraftContact(updated.contactNo ?? "");
      setAuthUser({ ...authUser, displayName: updated.displayName, username: updated.username });
      setIsEditing(false);
      toast("Profile saved.");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to save profile.", "error");
    } finally {
      setSaving(false);
    }
  }

  function handleAvatarFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) { toast("Only JPEG, PNG, or WebP files are supported.", "error"); return; }
    if (file.size > MAX_AVATAR_BYTES) { toast("Avatar must be smaller than 5 MB.", "error"); return; }
    setCropMode("avatar");
    setCropSrc(URL.createObjectURL(file));
  }

  function handleCoverFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) { toast("Only JPEG, PNG, or WebP files are supported.", "error"); return; }
    if (file.size > MAX_COVER_BYTES) { toast("Cover must be smaller than 10 MB.", "error"); return; }
    setCropMode("cover");
    setCropSrc(URL.createObjectURL(file));
  }

  const handleCropConfirm = useCallback(
    async (croppedFile: File) => {
      setCropSrc(null);
      if (!authUser) return;

      if (cropMode === "avatar") {
        setUploadingAvatar(true);
        try {
          let newUrl: string;
          try {
            const { uploadUrl, fileUrl, key } = await getAvatarUploadUrl(croppedFile.type);
            await uploadAvatarToSignedUrl(uploadUrl, croppedFile);
            newUrl = await confirmAvatarUpload(fileUrl, key);
          } catch (e) {
            if (e instanceof TypeError) { newUrl = await uploadAvatarDirect(croppedFile); }
            else throw e;
          }
          setProfile((p) => (p ? { ...p, avatarUrl: newUrl } : p));
          setAuthUser({ ...authUser, avatarUrl: newUrl });
          toast("Avatar updated.");
        } catch (err: unknown) {
          toast(err instanceof Error ? err.message : "Avatar upload failed.", "error");
        } finally {
          setUploadingAvatar(false);
        }
      } else {
        setUploadingCover(true);
        try {
          const newUrl = await uploadCoverDirect(croppedFile);
          setProfile((p) => (p ? { ...p, coverUrl: newUrl } : p));
          toast("Cover updated.");
        } catch (err: unknown) {
          toast(err instanceof Error ? err.message : "Cover upload failed.", "error");
        } finally {
          setUploadingCover(false);
        }
      }
    },
    [authUser, setAuthUser, cropMode, toast]
  );

  async function handleVerifyPassword() {
    if (!currentPw) return;
    setPwLoading(true);
    try {
      await verifyCurrentPassword(currentPw);
      setPwStep("confirm");
      toast("OTP sent to your email.");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to verify password.", "error");
    } finally {
      setPwLoading(false);
    }
  }

  async function handleChangePassword() {
    if (newPw.length < 8) { toast("New password must be at least 8 characters.", "error"); return; }
    if (newPw !== confirmPw) { toast("Passwords do not match.", "error"); return; }
    setPwLoading(true);
    try {
      await confirmPasswordChange(otp, newPw);
      setCurrentPw(""); setOtp(""); setNewPw(""); setConfirmPw("");
      setPwStep("idle");
      toast("Password changed.");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to change password.", "error");
    } finally {
      setPwLoading(false);
    }
  }

  const handleBecomeCreator = async () => {
    if (!authUser) return;
    setBecomingCreator(true);
    try {
      await becomeCreator();
      setAuthUser({ ...authUser, isCreator: true });
      setProfile((prev) => (prev ? { ...prev, isCreator: true } : prev));
      toast("You are now a creator! Upload button is now visible in the navbar.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to become creator", "error");
    } finally {
      setBecomingCreator(false);
    }
  };

  async function handleDeleteAccount() {
    if (delConfirm !== "DELETE") { toast('Type "DELETE" to confirm.', "error"); return; }
    if (!delPw) { toast("Password is required.", "error"); return; }
    setDeleting(true);
    try {
      await deleteAccount(delPw);
      setAuthUser(null);
      await refreshUser();
      router.push("/");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to delete account.", "error");
    } finally {
      setDeleting(false);
    }
  }

  if (!authLoaded || loading) {
    return (
      <div style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>
        <div className="w-full animate-pulse" style={{ height: 200, background: "var(--bg-elevated)" }} />
        <div className="max-w-6xl mx-auto px-6">
          <div className="animate-pulse" style={{ marginTop: -48, marginBottom: 32 }}>
            <div className="w-24 h-24 rounded-full mx-auto mb-4" style={{ background: "var(--bg-elevated)" }} />
            <div className="h-6 w-40 rounded mx-auto mb-2" style={{ background: "var(--bg-elevated)" }} />
            <div className="h-4 w-24 rounded mx-auto" style={{ background: "var(--bg-elevated)" }} />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <p className="text-sm" style={{ color: "#ef4444" }}>Could not load profile. Please refresh.</p>
      </div>
    );
  }

  const avatarUrl = profile.avatarUrl;
  const initials = (profile.displayName?.[0] ?? "U").toUpperCase();

  return (
    <>
      {cropSrc && (
        <AvatarCropper
          src={cropSrc}
          shape={cropMode === "cover" ? "banner" : "circle"}
          onConfirm={handleCropConfirm}
          onCancel={() => { URL.revokeObjectURL(cropSrc); setCropSrc(null); }}
        />
      )}

      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Select avatar image" onChange={handleAvatarFileSelect} />
      <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Select cover image" onChange={handleCoverFileSelect} />

      <main style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>

        {/* ── Banner ────────────────────────────────────────── */}
        <div
          className="relative w-full"
          style={{ height: 220, borderBottom: "1px solid var(--border)", cursor: "pointer" }}
          onMouseEnter={() => setBannerHovered(true)}
          onMouseLeave={() => setBannerHovered(false)}
          onClick={() => !uploadingCover && coverInputRef.current?.click()}
        >
          {profile.coverUrl ? (
            <img src={profile.coverUrl} alt="Cover" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <>
              <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(64,192,87,0.10) 0%, rgba(26,26,26,0) 55%), var(--bg-elevated)" }} />
              <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(255,255,255,1) 39px,rgba(255,255,255,1) 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(255,255,255,1) 39px,rgba(255,255,255,1) 40px)" }} />
            </>
          )}
          <div className="absolute inset-0 transition-opacity duration-200" style={{ background: "rgba(0,0,0,0.35)", opacity: bannerHovered ? 1 : 0, pointerEvents: "none" }} />
          <div
            className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
            style={{ background: "rgba(10,10,10,0.82)", color: "#fff", border: "1px solid rgba(255,255,255,0.18)", backdropFilter: "blur(8px)", opacity: bannerHovered || uploadingCover ? 1 : 0, transform: bannerHovered || uploadingCover ? "translateY(0)" : "translateY(6px)", pointerEvents: bannerHovered ? "auto" : "none" }}
          >
            {uploadingCover ? <div className="w-3.5 h-3.5 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} /> : <IcImage />}
            {uploadingCover ? "Uploading…" : "Change cover"}
          </div>
          <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: -48 }} onClick={(e) => e.stopPropagation()}>
            <AvatarHoverButton avatarUrl={avatarUrl} initials={initials} uploading={uploadingAvatar} onClick={() => fileInputRef.current?.click()} />
          </div>
        </div>

        {/* ── Profile header ─────────────────────────────────── */}
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center pt-16 pb-6">
            <h1 className="text-2xl font-semibold mb-0.5" style={{ color: "var(--text-primary)" }}>
              {profile.displayName}
            </h1>
            <p className="text-sm mb-3" style={{ color: "var(--accent)" }}>
              @{profile.username}
            </p>
            <div className="flex items-center justify-center gap-2 mb-4">
              {profile.isPro && (
                <span className="text-[10px] font-semibold tracking-widest uppercase px-2.5 py-1 rounded-full" style={{ background: "rgba(64,192,87,0.15)", color: "var(--accent)", border: "1px solid rgba(64,192,87,0.3)" }}>Pro</span>
              )}
              {profile.isCreator && (
                <span className="text-[10px] font-semibold tracking-widest uppercase px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>Creator</span>
              )}
            </div>
            {profile.bio && (
              <p className="text-sm max-w-md mx-auto mb-5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {profile.bio}
              </p>
            )}
            <div className="inline-flex items-center gap-0 rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--bg-elevated)" }}>
              {[
                { icon: <IcDownload />, value: profile.totalDownloads.toLocaleString(), label: "Downloads" },
                { icon: <IcUpload />, value: profile.totalUploads.toLocaleString(), label: "Uploads" },
                { icon: <IcCalendar />, value: formatDate(profile.createdAt), label: "Member since" },
              ].map((stat, i) => (
                <div key={stat.label} className="flex flex-col items-center px-5 py-3" style={{ borderLeft: i > 0 ? "1px solid var(--border)" : undefined }}>
                  <div className="flex items-center gap-1.5 mb-0.5" style={{ color: "var(--text-muted)" }}>
                    {stat.icon}
                    <span className="text-[10px] tracking-wider uppercase">{stat.label}</span>
                  </div>
                  <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{stat.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Personal Information & Settings ──────────────── */}
          <div className="pt-6" style={{ borderTop: "1px solid var(--border)" }}>

            {/* section header */}
            <div className="flex items-center justify-between mb-5">
              <p className="text-xs tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>
                {isEditing ? "Editing profile" : "Personal information & settings"}
              </p>
              {isEditing ? (
                <div className="flex gap-2">
                  <button onClick={cancelEdit} className="px-4 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-70" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-40" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              ) : (
                <button onClick={openEdit} className="px-4 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>
                  Edit profile
                </button>
              )}
            </div>

            {/* unified card */}
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--bg-elevated)" }}>
              <div className="grid grid-cols-1 lg:grid-cols-2">

                {/* ── Left: profile fields ──────────────────────── */}
                <div className="p-6 space-y-4">
                  <FieldRow icon={<IcUser />} label="Display name">
                    {isEditing ? (
                      <input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="Your name" style={inputBase(true)} />
                    ) : (
                      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{profile.displayName || "—"}</span>
                    )}
                  </FieldRow>
                  <FieldRow icon={<IcAt />} label="Username">
                    {isEditing ? (
                      <input value={draftUsername} onChange={(e) => setDraftUsername(e.target.value.replace(/\s/g, "").toLowerCase())} placeholder="your_handle" style={inputBase(true)} />
                    ) : (
                      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{profile.username || "—"}</span>
                    )}
                  </FieldRow>
                  <FieldRow icon={<IcPhone />} label="Contact number">
                    {isEditing ? (
                      <input value={draftContact} onChange={(e) => setDraftContact(e.target.value)} placeholder="+91 98765 43210" style={inputBase(true)} />
                    ) : (
                      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{profile.contactNo || "—"}</span>
                    )}
                  </FieldRow>
                  <FieldRow icon={<IcMail />} label="Email address">
                    <span className="text-sm" style={{ color: "var(--text-secondary)", opacity: 0.7 }}>{profile.email}</span>
                    <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)" }}>Locked</span>
                  </FieldRow>
                  <div>
                    <p className="text-[10px] tracking-widest uppercase mb-1.5" style={{ color: "var(--text-muted)" }}>Bio</p>
                    {isEditing ? (
                      <textarea value={draftBio} onChange={(e) => setDraftBio(e.target.value)} placeholder="Tell people what you create on Aurora…" rows={3} style={{ ...inputStyleBase, resize: "vertical" }} />
                    ) : (
                      <p className="text-sm leading-relaxed" style={{ color: profile.bio ? "var(--text-secondary)" : "var(--text-muted)" }}>
                        {profile.bio || "No bio yet."}
                      </p>
                    )}
                  </div>
                </div>

                {/* ── Right: security ──────────────────────────── */}
                {/* border-t on mobile, border-l on desktop */}
                <div
                  className="flex flex-col border-t lg:border-t-0 lg:border-l"
                  style={{ borderColor: "var(--border)" }}
                >
                  {/* 2FA — coming soon */}
                  <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                    <div className="flex items-center gap-3">
                      <IcShield />
                      <div>
                        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Two-factor authentication</p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Coming soon — extra security for your account</p>
                      </div>
                    </div>
                    <span
                      className="text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full"
                      style={{ background: "var(--bg-primary)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                    >
                      Soon
                    </span>
                  </div>

                  {/* Password */}
                  <div className="px-6 py-5 flex-1" style={{ borderBottom: "1px solid var(--border)" }}>
                    <div className="flex items-center gap-3">
                      <IcLock />
                      <div>
                        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Password</p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Change via email OTP verification</p>
                      </div>
                    </div>
                    {pwStep === "idle" && (
                      <button onClick={() => setPwStep("verify")} className="mt-4 w-full py-2.5 rounded-lg text-sm font-medium px-4 flex items-center justify-center gap-2 transition-colors hover:bg-white/5" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                        Change password
                      </button>
                    )}
                    {pwStep === "verify" && (
                      <div className="space-y-3 mt-4">
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Enter your current password to receive an OTP.</p>
                        <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="Current password" style={inputStyleBase} />
                        <div className="flex gap-2">
                          <button onClick={() => { setPwStep("idle"); setCurrentPw(""); }} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
                          <button onClick={handleVerifyPassword} disabled={pwLoading || !currentPw} className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-40" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>{pwLoading ? "Verifying…" : "Send OTP"}</button>
                        </div>
                      </div>
                    )}
                    {pwStep === "confirm" && (
                      <div className="space-y-3 mt-4">
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Check your email for the 6-digit OTP.</p>
                        <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit OTP" className="tracking-widest text-center" style={inputStyleBase} />
                        <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="New password" style={inputStyleBase} />
                        <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Confirm new password" style={{ ...inputStyleBase, borderColor: confirmPw && newPw && confirmPw === newPw ? "#40C057" : confirmPw && newPw && confirmPw.length >= newPw.length && confirmPw !== newPw ? "#ef4444" : "var(--border)" }} />
                        <div className="flex gap-2">
                          <button onClick={() => { setPwStep("idle"); setOtp(""); setNewPw(""); setConfirmPw(""); }} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
                          <button onClick={handleChangePassword} disabled={pwLoading || otp.length !== 6 || !newPw || !confirmPw} className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-40" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>{pwLoading ? "Updating…" : "Update password"}</button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Delete account */}
                  <div className="px-6 py-5" style={{ background: "rgba(239,68,68,0.04)" }}>
                    <h3 className="text-sm font-semibold mb-1" style={{ color: "#ef4444" }}>Delete account</h3>
                    <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                      Permanently deletes your account, avatar, and all data. This cannot be undone.
                    </p>
                    <div className="space-y-3">
                      <input type="password" value={delPw} onChange={(e) => setDelPw(e.target.value)} placeholder="Your password" style={inputStyleBase} />
                      <input value={delConfirm} onChange={(e) => setDelConfirm(e.target.value)} placeholder='Type "DELETE" to confirm' style={{ ...inputStyleBase, borderColor: delConfirm === "DELETE" ? "#ef4444" : "var(--border)" }} />
                      <button onClick={handleDeleteAccount} disabled={deleting || !delPw || delConfirm !== "DELETE"} className="w-full py-2.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-40" style={{ background: "#ef4444", color: "#fff" }}>
                        {deleting ? "Deleting account…" : "Delete my account"}
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {!profile.isCreator && (
            <div
              className="rounded-2xl p-6 mb-6 mt-3"
              style={{ border: "1px solid var(--border)", background: "var(--bg-elevated)" }}
            >
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1">
                  <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                    Become a Creator
                  </h2>
                  <p className="text-xs leading-relaxed mb-3" style={{ color: "var(--text-muted)" }}>
                    Share your wallpapers with the Aurora community. Upload your best work and grow your audience.
                  </p>
                  <div className="flex flex-wrap items-center gap-4">
                    {["Upload wallpapers", "Creator badge", "Download analytics"].map((benefit) => (
                      <div key={benefit} className="flex items-center gap-1.5">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                          stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                          {benefit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleBecomeCreator}
                  disabled={becomingCreator}
                  className="flex-shrink-0 px-5 py-2.5 rounded-full text-xs font-medium tracking-wide transition-opacity hover:opacity-80 disabled:opacity-40"
                  style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
                >
                  {becomingCreator ? "Activating…" : "Get started →"}
                </button>
              </div>
            </div>
          )}

          {/* ── My Uploads ───────────────────────────────────────── */}
          <div style={{ marginTop: 24, marginBottom: 8 }}>
            <UserUploadsSection
              isCreator={profile.isCreator}
              onUploadCountChange={(delta) =>
                setProfile((p) => p ? { ...p, totalUploads: Math.max(0, p.totalUploads + delta) } : p)
              }
            />
          </div>

          {/* ── Liked Wallpapers + Collections ──────────────────── */}
          <div
            className="grid grid-cols-1 xl:grid-cols-2 gap-10 pt-8 pb-16"
            style={{ borderTop: "1px solid var(--border)", marginTop: 24 }}
          >

            {/* ── Liked Wallpapers (left) ─────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-sm font-semibold tracking-wide" style={{ color: "var(--text-primary)" }}>
                    Liked Wallpapers
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {likedWallpapers.length} wallpaper{likedWallpapers.length !== 1 ? "s" : ""}
                  </p>
                </div>
                {likedWallpapers.length > 0 && (
                  <Link href="/" className="text-xs tracking-widest uppercase transition-opacity hover:opacity-70" style={{ color: "var(--accent)" }}>
                    Discover more →
                  </Link>
                )}
              </div>

              {likedLoading ? (
                <div className="grid grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="aspect-[3/4] rounded-xl animate-pulse" style={{ background: "var(--bg-elevated)" }} />
                  ))}
                </div>
              ) : likedWallpapers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 rounded-2xl" style={{ border: "1px dashed var(--border)" }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3" style={{ color: "var(--text-muted)" }}>
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                  <p className="text-sm mb-1" style={{ color: "var(--text-muted)" }}>No liked wallpapers yet</p>
                  <p className="text-xs mb-3" style={{ color: "var(--text-muted)", opacity: 0.7 }}>Wallpapers you heart will appear here</p>
                  <Link href="/" className="text-xs px-4 py-2 rounded-lg transition-opacity hover:opacity-70" style={{ color: "var(--accent)", border: "1px solid rgba(64,192,87,0.3)" }}>
                    Browse wallpapers →
                  </Link>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    {likedWallpapers.slice(0, visibleCount).map((w) => (
                      <Link key={w.id} href={`/wallpaper/${w.id}`}>
                        <div
                          className="relative aspect-[3/4] rounded-xl overflow-hidden group"
                          style={{ backgroundColor: w.dominantColor }}
                          onContextMenu={(e) => e.preventDefault()}
                        >
                          <Image
                            src={w.fileUrl}
                            alt={w.title}
                            fill
                            sizes="(max-width: 640px) 50vw, 33vw"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          <div
                            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end p-2"
                            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%)" }}
                          >
                            <p className="text-xs font-medium line-clamp-2 leading-tight" style={{ color: "var(--text-primary)" }}>
                              {w.title}
                            </p>
                          </div>
                          <div className="absolute top-2 right-2 flex items-center justify-center w-6 h-6 rounded-full" style={{ background: "rgba(239,68,68,0.85)" }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
                              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                            </svg>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                  {visibleCount < likedWallpapers.length && (
                    <div className="flex justify-center mt-5">
                      <button
                        onClick={() => setVisibleRows((r) => r + 1)}
                        className="flex items-center gap-2.5 px-5 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:brightness-110"
                        style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", background: "var(--bg-elevated)" }}
                      >
                        Show more
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}>
                          {likedWallpapers.length - visibleCount} remaining
                        </span>
                        <IcChevronDown />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ── Collections (right) ─────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-sm font-semibold tracking-wide" style={{ color: "var(--text-primary)" }}>
                    My Collections
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {collections.length} collection{collections.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {collectionsLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="aspect-[3/4] rounded-xl animate-pulse" style={{ background: "var(--bg-elevated)" }} />
                  ))}
                </div>
              ) : collections.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 rounded-2xl" style={{ border: "1px dashed var(--border)" }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3" style={{ color: "var(--text-muted)" }}>
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                  </svg>
                  <p className="text-sm mb-1" style={{ color: "var(--text-muted)" }}>No collections yet</p>
                  <p className="text-xs text-center px-6" style={{ color: "var(--text-muted)", opacity: 0.7 }}>
                    Save wallpapers to collections and they&apos;ll appear here
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {collections.map((col) => (
                    <Link key={col.id} href={`/collection/${col.id}`}>
                      <div className="group cursor-pointer">
                        <div
                          className="relative aspect-[3/4] rounded-xl overflow-hidden"
                          style={{ backgroundColor: "var(--bg-elevated)" }}
                        >
                          {col.coverUrl ? (
                            <Image
                              src={col.coverUrl}
                              alt={col.title}
                              fill
                              sizes="(max-width: 640px) 50vw, 33vw"
                              className="object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ color: "var(--text-muted)" }}>
                              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                              </svg>
                              <span className="text-[11px]">Empty</span>
                            </div>
                          )}

                          {/* bottom gradient always visible */}
                          <div
                            className="absolute inset-0"
                            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.78) 0%, transparent 52%)" }}
                          />

                          {/* title + count */}
                          <div className="absolute bottom-0 left-0 right-0 p-2.5">
                            <p className="text-xs font-semibold line-clamp-1 leading-snug" style={{ color: "#fff" }}>
                              {col.title}
                            </p>
                            <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                              {col.wallpaperCount} {col.wallpaperCount === 1 ? "wallpaper" : "wallpapers"}
                            </p>
                          </div>

                          {/* visibility badge */}
                          <div className="absolute top-2 right-2">
                            <span
                              className="text-[9px] tracking-wider uppercase px-1.5 py-0.5 rounded-full font-medium"
                              style={{
                                background: col.isPublic ? "rgba(64,192,87,0.88)" : "rgba(0,0,0,0.52)",
                                color: "#fff",
                                backdropFilter: "blur(4px)",
                                border: col.isPublic ? "none" : "1px solid rgba(255,255,255,0.14)",
                              }}
                            >
                              {col.isPublic ? "Public" : "Private"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </main>
    </>
  );
}