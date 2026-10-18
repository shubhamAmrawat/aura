"use client";

import { ChangeEvent, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Wallpaper } from "@aura/types";
import AvatarCropper from "@/app/components/AvatarCropper";
import AvatarImage from "@/app/components/AvatarImage";
import WallpaperCard from "@/app/components/WallpaperCard";
import UserUploadsSection from "@/app/components/UserUploadsSection";
import EditProfileDrawer from "./EditProfileDrawer";
import {
  confirmAvatarUpload,
  getAvatarUploadUrl,
  getProfile,
  type ProfileUser,
  uploadAvatarDirect,
  uploadAvatarToSignedUrl,
  uploadCoverDirect,
} from "@/lib/profileApi";
import { getUserCollections, type Collection } from "@/lib/collectionsApi";
import { getLikedWallpapers } from "@/lib/likesApi";
import { becomeCreator } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { useAuth } from "@/lib/authContext";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const MAX_COVER_BYTES = 10 * 1024 * 1024;

type Tab = "uploads" | "liked" | "collections";
const TABS: Tab[] = ["uploads", "liked", "collections"];

/** Row shape returned by GET /api/likes. */
type LikedRow = {
  id: string;
  title: string;
  fileUrl: string;
  thumbUrl?: string | null;
  blurhash: string;
  dominantColor: string;
  width: number;
  height: number;
  likeCount: number;
  downloadCount: number;
  likedAt?: string;
};

function toCard(w: LikedRow): Wallpaper {
  return {
    ...w,
    description: null,
    palette: [],
    tags: [],
    fileSizeBytes: 0,
    format: "jpeg",
    createdAt: w.likedAt ?? new Date().toISOString(),
    isPremium: false,
    isFeatured: false,
    isMobile: w.height >= w.width,
  };
}

const formatJoined = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });

// ─── small pieces ─────────────────────────────────────────────
function Stat({ icon, value, label, hint }: { icon: React.ReactNode; value: React.ReactNode; label: string; hint?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--accent)" }}
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="flex flex-col">
        <span className="text-xl font-semibold leading-tight tracking-[-0.02em] tabular-nums" style={{ color: "var(--text-primary)" }}>{value}</span>
        <span className="flex items-center gap-1 text-[13px]" style={{ color: "var(--text-muted)" }}>
          {label}
          {hint && (
            <span className="relative group/tip inline-flex">
              <button
                type="button"
                aria-label={hint}
                className="w-5 h-5 -my-1 rounded-full flex items-center justify-center transition-colors hover:text-[color:var(--text-primary)] focus-visible:text-[color:var(--text-primary)] outline-none"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 7.5h.01" /></svg>
              </button>
              <span
                role="tooltip"
                className="pointer-events-none absolute left-1/2 bottom-full mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs opacity-0 translate-y-1 transition-all duration-150 group-hover/tip:opacity-100 group-hover/tip:translate-y-0 group-focus-within/tip:opacity-100 group-focus-within/tip:translate-y-0 z-10"
                style={{ background: "#1f1f1f", color: "var(--text-primary)", border: "1px solid var(--border-hover)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
              >
                {hint}
              </span>
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

/* 18px stroke icons shared by the stats row and the tabs */
const ic = (d: React.ReactNode, size = 18) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const ICONS = {
  uploads: (size?: number) => ic(<><path d="M12 15V4" /><path d="M7 8.5l5-5 5 5" /><path d="M5 20h14" /></>, size),
  downloads: (size?: number) => ic(<><path d="M12 4v11" /><path d="M7 10.5l5 5 5-5" /><path d="M5 20h14" /></>, size),
  liked: (size?: number) => ic(<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z" />, size),
  collections: (size?: number) => ic(<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />, size),
};

function EmptyState({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6 rounded-3xl" style={{ border: "1px dashed var(--border-hover)" }}>
      <div className="mb-4" style={{ color: "var(--text-muted)" }}>{icon}</div>
      <p className="text-base font-medium mb-1" style={{ color: "var(--text-primary)" }}>{title}</p>
      <p className="text-sm mb-5 max-w-sm" style={{ color: "var(--text-muted)" }}>{body}</p>
      {action}
    </div>
  );
}

const GridSkeleton = () => (
  <div className="columns-2 sm:columns-3 md:columns-4 xl:columns-5 gap-4">
    {Array.from({ length: 10 }).map((_, i) => (
      <div key={i} className="break-inside-avoid mb-4 rounded-2xl animate-pulse" style={{ background: "var(--bg-elevated)", aspectRatio: i % 3 === 0 ? "16 / 10" : "3 / 4" }} />
    ))}
  </div>
);

const HeartIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);
const BookmarkIcon = ({ size = 32 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);

// ─── page ─────────────────────────────────────────────────────
function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user: authUser, setUser: setAuthUser, loaded: authLoaded } = useAuth();

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [liked, setLiked] = useState<LikedRow[]>([]);
  const [likedLoading, setLikedLoading] = useState(true);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(true);

  const [editOpen, setEditOpen] = useState(searchParams.get("edit") === "1");
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropMode, setCropMode] = useState<"avatar" | "cover">("avatar");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [becomingCreator, setBecomingCreator] = useState(false);

  const tabParam = searchParams.get("tab");
  const requestedTab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : null;
  // Default: creators (or anyone with uploads) land on Uploads, everyone else on Liked.
  const tab: Tab = requestedTab ?? (profile && (profile.isCreator || profile.totalUploads > 0) ? "uploads" : "liked");

  const selectTab = (t: Tab) => router.replace(`/profile?tab=${t}`, { scroll: false });

  useEffect(() => {
    if (!authLoaded) return;
    if (!authUser) {
      router.push("/login?next=%2Fprofile");
      return;
    }
    getProfile()
      .then(setProfile)
      .catch((err: unknown) => toast(err instanceof Error ? err.message : "Failed to load profile", "error"))
      .finally(() => setLoading(false));
    getLikedWallpapers()
      .then((rows: LikedRow[]) => setLiked(rows ?? []))
      .catch(() => setLiked([]))
      .finally(() => setLikedLoading(false));
    getUserCollections()
      .then(setCollections)
      .catch(() => setCollections([]))
      .finally(() => setCollectionsLoading(false));
  }, [authLoaded, authUser, router, toast]);

  function pickImage(e: ChangeEvent<HTMLInputElement>, mode: "avatar" | "cover") {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) { toast("Only JPEG, PNG, or WebP files are supported.", "error"); return; }
    if (mode === "avatar" && file.size > MAX_AVATAR_BYTES) { toast("Photo must be smaller than 5 MB.", "error"); return; }
    if (mode === "cover" && file.size > MAX_COVER_BYTES) { toast("Cover must be smaller than 10 MB.", "error"); return; }
    setCropMode(mode);
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
            if (e instanceof TypeError) newUrl = await uploadAvatarDirect(croppedFile);
            else throw e;
          }
          setProfile((p) => (p ? { ...p, avatarUrl: newUrl } : p));
          setAuthUser({ ...authUser, avatarUrl: newUrl });
          toast("Photo updated.");
        } catch (err: unknown) {
          toast(err instanceof Error ? err.message : "Photo upload failed.", "error");
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

  const handleBecomeCreator = async () => {
    if (!authUser) return;
    setBecomingCreator(true);
    try {
      await becomeCreator();
      setAuthUser({ ...authUser, isCreator: true });
      setProfile((prev) => (prev ? { ...prev, isCreator: true } : prev));
      toast("You’re a creator now. Upload your first wallpaper!");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to become creator", "error");
    } finally {
      setBecomingCreator(false);
    }
  };

  const handleProfileSaved = (updated: ProfileUser) => {
    setProfile(updated);
    if (authUser) setAuthUser({ ...authUser, displayName: updated.displayName, username: updated.username });
  };

  const closeEdit = () => {
    setEditOpen(false);
    if (searchParams.get("edit")) router.replace(`/profile${requestedTab ? `?tab=${requestedTab}` : ""}`, { scroll: false });
  };

  if (!authLoaded || loading) {
    return (
      <main className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
        <div className="h-[260px] sm:h-[320px] animate-pulse" style={{ background: "var(--bg-elevated)" }} />
        <div className="max-w-[1344px] mx-auto px-6 sm:px-12 flex items-end gap-7 -mt-[68px]">
          <div className="w-[136px] h-[136px] rounded-full animate-pulse" style={{ background: "#1c1c1c", border: "5px solid var(--bg-primary)" }} />
          <div className="flex-1 pb-3 space-y-3">
            <div className="h-9 w-72 rounded-lg animate-pulse" style={{ background: "var(--bg-elevated)" }} />
            <div className="h-4 w-48 rounded animate-pulse" style={{ background: "var(--bg-elevated)" }} />
          </div>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <p className="text-sm" style={{ color: "#ef4444" }}>Could not load your profile. Please refresh.</p>
      </main>
    );
  }

  const initials = (profile.displayName?.[0] ?? "U").toUpperCase();
  const counts: Record<Tab, number | null> = {
    uploads: profile.totalUploads,
    liked: likedLoading ? null : liked.length,
    collections: collectionsLoading ? null : collections.length,
  };
  const tabLabel: Record<Tab, string> = { uploads: "Uploads", liked: "Liked", collections: "Collections" };

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
      <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Choose profile photo" onChange={(e) => pickImage(e, "avatar")} />
      <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Choose cover image" onChange={(e) => pickImage(e, "cover")} />

      {editOpen && (
        <EditProfileDrawer
          profile={profile}
          uploadingAvatar={uploadingAvatar}
          uploadingCover={uploadingCover}
          onPickAvatar={() => avatarInputRef.current?.click()}
          onPickCover={() => coverInputRef.current?.click()}
          onSaved={handleProfileSaved}
          onClose={closeEdit}
        />
      )}

      <main className="min-h-screen pb-20" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
        {/* ── cover ── */}
        <div className="relative h-[260px] sm:h-[320px] overflow-hidden">
          {profile.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div
              className="absolute inset-0"
              style={{ background: "radial-gradient(ellipse 80% 120% at 20% 0%, rgba(129,238,78,0.16), transparent 60%), radial-gradient(ellipse 70% 120% at 85% 10%, rgba(139,124,246,0.16), transparent 60%), var(--bg-elevated)" }}
            />
          )}
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(10,10,10,0.55) 0%, rgba(10,10,10,0) 30%, rgba(10,10,10,0.2) 60%, var(--bg-primary) 100%)" }} />
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            disabled={uploadingCover}
            className="absolute right-6 sm:right-12 bottom-24 sm:bottom-7 h-9 px-3.5 rounded-full text-[13px] font-medium flex items-center gap-2 transition-colors hover:bg-black/70 disabled:opacity-70"
            style={{ background: "rgba(10,10,10,0.55)", border: "1px solid rgba(255,255,255,0.14)", color: "#f0f0f0", backdropFilter: "blur(10px)" }}
          >
            {uploadingCover ? (
              <span className="w-3.5 h-3.5 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 17l-5-5-9 7" /></svg>
            )}
            {uploadingCover ? "Uploading…" : profile.coverUrl ? "Change cover" : "Add a cover"}
          </button>
        </div>

        <div className="max-w-[1344px] mx-auto px-6 sm:px-12">
          {/* ── identity ── */}
          <div className="relative flex flex-wrap items-end gap-x-7 gap-y-5 -mt-[72px]">
            <div className="relative shrink-0">
              <div className="w-[136px] h-[136px] rounded-full p-[5px]" style={{ background: "var(--bg-primary)" }}>
                <AvatarImage
                  src={profile.avatarUrl}
                  alt={profile.displayName || "Profile photo"}
                  className="w-full h-full rounded-full object-cover"
                  fallback={
                    <div className="w-full h-full rounded-full flex items-center justify-center text-5xl font-semibold" style={{ background: "linear-gradient(135deg, var(--accent), #2dd4bf)", color: "var(--bg-primary)" }}>
                      {initials}
                    </div>
                  }
                />
                {uploadingAvatar && (
                  <div className="absolute inset-[5px] rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.55)" }}>
                    <span className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                aria-label="Change profile photo"
                className="absolute right-1.5 bottom-2 w-[34px] h-[34px] rounded-full flex items-center justify-center transition-transform hover:scale-105"
                style={{ border: "3px solid var(--bg-primary)", background: "var(--text-primary)", color: "var(--bg-primary)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
              </button>
            </div>

            <div className="flex-[1_1_380px] min-w-0 pb-1.5">
              <h1 className="text-[40px] sm:text-[48px] leading-[1.02] tracking-[-0.01em] break-words" style={{ fontFamily: "var(--font-serif), serif" }}>
                {profile.displayName}
              </h1>
              <div className="flex flex-wrap items-center gap-2.5 mt-2.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                <span style={{ color: "#e5e5e5" }}>@{profile.username}</span>
                {profile.isCreator && (
                  <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-xs font-medium" style={{ background: "var(--accent-muted)", color: "var(--accent)" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l2.6 5.5 6 .8-4.4 4.2 1.1 6L12 16.6 6.7 19.5l1.1-6L3.4 9.3l6-.8z" /></svg>
                    Creator
                  </span>
                )}
                {profile.isPro && (
                  <span className="inline-flex items-center h-6 px-2.5 rounded-full text-xs font-medium" style={{ background: "rgba(255,255,255,0.08)", color: "#e5e5e5" }}>Pro</span>
                )}
                <span aria-hidden="true">·</span>
                <span>Joined {formatJoined(profile.createdAt)}</span>
              </div>
              {profile.bio ? (
                <p className="mt-3 text-[15px] leading-relaxed max-w-[560px] whitespace-pre-line" style={{ color: "#c4c4c4" }}>{profile.bio}</p>
              ) : (
                <button type="button" onClick={() => setEditOpen(true)} className="mt-3 text-[15px] underline underline-offset-4 decoration-white/20 hover:decoration-white/60" style={{ color: "var(--text-muted)" }}>
                  Add a bio
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5 pb-2">
              {profile.isCreator && (
                <Link
                  href="/upload"
                  className="h-11 px-5 rounded-full text-sm font-semibold inline-flex items-center gap-2 transition-opacity hover:opacity-90"
                  style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                  Upload
                </Link>
              )}
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="h-11 px-5 rounded-full text-sm font-medium border border-white/[0.16] transition-colors hover:bg-white/[0.05]"
              >
                Edit profile
              </button>
              <Link
                href="/settings"
                aria-label="Account settings"
                title="Account settings"
                className="w-11 h-11 rounded-full flex items-center justify-center border border-white/[0.12] transition-colors hover:bg-white/[0.06]"
                style={{ background: "rgba(255,255,255,0.04)", color: "#e8e8e8" }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
              </Link>
            </div>
          </div>

          {/* ── stats ── */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:flex sm:flex-wrap sm:gap-x-10 mt-7 py-5" style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
            {(profile.isCreator || profile.totalUploads > 0) && (
              <>
                <Stat icon={ICONS.uploads()} value={profile.totalUploads.toLocaleString()} label="Uploads" />
                <Stat icon={ICONS.downloads()} value={profile.totalDownloads.toLocaleString()} label="Downloads" hint="Total downloads of your uploads" />
              </>
            )}
            <Stat icon={ICONS.liked()} value={likedLoading ? "–" : liked.length.toLocaleString()} label="Liked" />
            <Stat icon={ICONS.collections()} value={collectionsLoading ? "–" : collections.length.toLocaleString()} label="Collections" />
          </div>

          {/* ── tabs ── */}
          <div role="tablist" aria-label="Profile sections" className="flex gap-5 sm:gap-7 mt-2" style={{ borderBottom: "1px solid var(--border)" }}>
            {TABS.map((t) => {
              const active = t === tab;
              return (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  id={`tab-${t}`}
                  aria-selected={active}
                  aria-controls={`panel-${t}`}
                  onClick={() => selectTab(t)}
                  className="pt-[18px] pb-4 text-[15px] whitespace-nowrap transition-colors flex items-center gap-2"
                  style={{
                    color: active ? "var(--text-primary)" : "#9a9a9a",
                    fontWeight: active ? 500 : 400,
                    borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
                    marginBottom: -1,
                  }}
                >
                  <span style={{ color: active ? "var(--accent)" : "inherit" }}>{ICONS[t](16)}</span>
                  {tabLabel[t]}
                  {counts[t] !== null && (
                    <span style={{ color: active ? "var(--text-muted)" : "#6f6f6f" }}>{counts[t]}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── panels ── */}
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-6">
            {tab === "uploads" &&
              (profile.isCreator || profile.totalUploads > 0 ? (
                <UserUploadsSection
                  isCreator={profile.isCreator}
                  onUploadCountChange={(delta) => setProfile((p) => (p ? { ...p, totalUploads: Math.max(0, p.totalUploads + delta) } : p))}
                />
              ) : (
                <div className="rounded-3xl p-8 sm:p-10 flex flex-wrap items-center justify-between gap-6" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                  <div className="max-w-xl">
                    <h2 className="text-[32px] leading-tight" style={{ fontFamily: "var(--font-serif), serif" }}>Share your own wallpapers</h2>
                    <p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      Become a creator to upload your work to Aurora. You’ll get a creator badge and see how your uploads are doing.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleBecomeCreator}
                    disabled={becomingCreator}
                    className="h-11 px-6 rounded-full text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
                    style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
                  >
                    {becomingCreator ? "Activating…" : "Become a creator"}
                  </button>
                </div>
              ))}

            {tab === "liked" &&
              (likedLoading ? (
                <GridSkeleton />
              ) : liked.length === 0 ? (
                <EmptyState
                  icon={<HeartIcon />}
                  title="No liked wallpapers yet"
                  body="Tap the heart on any wallpaper and it will show up here."
                  action={<Link href="/" className="h-11 px-5 rounded-full text-sm font-semibold flex items-center" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>Browse wallpapers</Link>}
                />
              ) : (
                <div className="columns-2 sm:columns-3 md:columns-4 xl:columns-5 gap-4">
                  {liked.map((w) => (
                    <div key={w.id} className="break-inside-avoid mb-4">
                      <WallpaperCard wallpaper={toCard(w)} />
                    </div>
                  ))}
                </div>
              ))}

            {tab === "collections" &&
              (collectionsLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="aspect-[4/5] rounded-2xl animate-pulse" style={{ background: "var(--bg-elevated)" }} />
                  ))}
                </div>
              ) : collections.length === 0 ? (
                <EmptyState
                  icon={<BookmarkIcon />}
                  title="No collections yet"
                  body="Use the bookmark on any wallpaper to save it into a collection."
                  action={<Link href="/" className="h-11 px-5 rounded-full text-sm font-semibold flex items-center" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>Browse wallpapers</Link>}
                />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                  {collections.map((col) => (
                    <Link key={col.id} href={`/collection/${col.id}`} className="group flex flex-col gap-3">
                      <div className="relative aspect-[4/5] rounded-2xl overflow-hidden" style={{ background: "var(--bg-elevated)" }}>
                        {col.coverUrl ? (
                          <Image
                            src={col.coverUrl}
                            alt=""
                            fill
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
                            <BookmarkIcon size={28} />
                          </div>
                        )}
                        {!col.isPublic && (
                          <span className="absolute top-3 right-3 h-[26px] px-2.5 rounded-full text-xs flex items-center gap-1.5" style={{ background: "rgba(10,10,10,0.6)", color: "#e5e5e5", backdropFilter: "blur(6px)" }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                            Private
                          </span>
                        )}
                      </div>
                      <div className="px-1">
                        <p className="text-base font-semibold truncate">{col.title}</p>
                        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
                          {col.wallpaperCount} {col.wallpaperCount === 1 ? "wallpaper" : "wallpapers"}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ))}
          </div>
        </div>
      </main>
    </>
  );
}

export default function ProfilePage() {
  return (
    <Suspense>
      <ProfileContent />
    </Suspense>
  );
}
