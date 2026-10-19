"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AvatarImage from "@/app/components/AvatarImage";
import { updateProfile, type ProfileUser } from "@/lib/profileApi";
import { useToast } from "@/lib/toast";
import { CameraIcon, MailIcon, XIcon } from "lucide-react";

const INPUT =
  "w-full h-12 px-3.5 rounded-xl text-[15px] bg-[#151515] border border-white/[0.08] outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[#6f6f6f] focus:border-[color:var(--accent)] focus:shadow-[0_0_0_4px_var(--accent-muted)]";
const USERNAME_COOLDOWN_DAYS = 14;

type Props = {
  profile: ProfileUser;
  uploadingAvatar: boolean;
  uploadingCover: boolean;
  onPickAvatar: () => void;
  onPickCover: () => void;
  onSaved: (updated: ProfileUser) => void;
  onClose: () => void;
};

/** Slide-over panel for editing the public parts of the profile (name, username, bio, contact, images). */
export default function EditProfileDrawer({ profile, uploadingAvatar, uploadingCover, onPickAvatar, onPickCover, onSaved, onClose }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState(profile.displayName ?? "");
  const [username, setUsername] = useState(profile.username ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [contact, setContact] = useState(profile.contactNo ?? "");
  const [saving, setSaving] = useState(false);
  const [shown, setShown] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const dirty =
    name !== (profile.displayName ?? "") ||
    username !== (profile.username ?? "") ||
    bio !== (profile.bio ?? "") ||
    contact !== (profile.contactNo ?? "");

  // Username can change once every 14 days (enforced by the API; shown here up front).
  const nextUsernameChange = (() => {
    if (!profile.usernameChangedAt) return null;
    const next = new Date(profile.usernameChangedAt);
    next.setDate(next.getDate() + USERNAME_COOLDOWN_DAYS);
    return next > new Date() ? next : null;
  })();

  const requestClose = () => {
    if (saving) return;
    if (dirty && !window.confirm("Discard your unsaved changes?")) return;
    setShown(false);
    setTimeout(onClose, 200);
  };

  // Slide in, lock page scroll, Esc closes.
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      cancelAnimationFrame(id);
      document.body.style.overflow = prev;
    };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && requestClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function save() {
    if (!name.trim()) { toast("Display name is required.", "error"); return; }
    if (username.trim().length < 3) { toast("Username must be at least 3 characters.", "error"); return; }
    setSaving(true);
    try {
      const updated = await updateProfile({
        displayName: name.trim(),
        username: username.trim().toLowerCase(),
        bio: bio.trim(),
        contactNo: contact.trim(),
      });
      onSaved({ ...profile, ...updated });
      toast("Profile saved.");
      setShown(false);
      setTimeout(onClose, 200);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save profile.", "error");
    } finally {
      setSaving(false);
    }
  }

  const initials = (profile.displayName?.[0] ?? "U").toUpperCase();

  return (
    <div className="fixed inset-0 z-[80]" role="presentation">
      <div
        className="absolute inset-0 transition-opacity duration-200"
        style={{ background: "rgba(5,5,5,0.72)", backdropFilter: "blur(3px)", opacity: shown ? 1 : 0 }}
        onClick={requestClose}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
        className="absolute inset-y-0 right-0 w-full max-w-[540px] flex flex-col outline-none transition-transform duration-200 ease-out"
        style={{
          background: "#0f0f0f",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "-40px 0 120px rgba(0,0,0,0.5)",
          transform: shown ? "translateX(0)" : "translateX(100%)",
        }}
      >
        <div className="flex items-center justify-between px-6 sm:px-7 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <h2 id="edit-profile-title" className="text-[30px] leading-none" style={{ fontFamily: "var(--font-serif), serif" }}>Edit profile</h2>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="w-11 h-11 rounded-full flex items-center justify-center transition-colors hover:bg-white/[0.08]"
            style={{ background: "rgba(255,255,255,0.04)", color: "#bdbdbd" }}
          >
            <XIcon size={16} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 sm:px-7 py-6 flex flex-col gap-[22px]">
          {/* cover + avatar */}
          <div className="relative mb-9">
            <div className="relative h-[150px] rounded-2xl overflow-hidden" style={{ background: "var(--bg-elevated)" }}>
              {profile.coverUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
              )}
              <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.25)" }} />
              <button
                type="button"
                onClick={onPickCover}
                disabled={uploadingCover}
                className="absolute right-3 top-3 h-9 px-3.5 rounded-full text-[13px] font-medium flex items-center gap-2 disabled:opacity-70"
                style={{ background: "rgba(10,10,10,0.6)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", backdropFilter: "blur(8px)" }}
              >
                {uploadingCover && <span className="w-3.5 h-3.5 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} />}
                {uploadingCover ? "Uploading…" : profile.coverUrl ? "Change cover" : "Add a cover"}
              </button>
            </div>
            <div className="absolute left-5 -bottom-10 w-[88px] h-[88px] rounded-full p-1" style={{ background: "#0f0f0f" }}>
              <AvatarImage
                src={profile.avatarUrl}
                alt=""
                className="w-full h-full rounded-full object-cover"
                fallback={
                  <div className="w-full h-full rounded-full flex items-center justify-center text-3xl font-semibold" style={{ background: "linear-gradient(135deg, var(--accent), #2dd4bf)", color: "var(--bg-primary)" }}>
                    {initials}
                  </div>
                }
              />
              {uploadingAvatar && (
                <div className="absolute inset-1 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.55)" }}>
                  <span className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} />
                </div>
              )}
              <button
                type="button"
                onClick={onPickAvatar}
                disabled={uploadingAvatar}
                aria-label="Change photo"
                className="absolute right-0 bottom-0.5 w-[30px] h-[30px] rounded-full flex items-center justify-center"
                style={{ border: "3px solid #0f0f0f", background: "var(--text-primary)", color: "var(--bg-primary)" }}
              >
                <CameraIcon size={12} strokeWidth={2.4} aria-hidden="true" />
              </button>
            </div>
            <p className="absolute right-0 -bottom-7 text-xs" style={{ color: "var(--text-muted)" }}>JPG, PNG or WebP · photo up to 5 MB, cover up to 10 MB</p>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="ep-name" className="text-[13px]" style={{ color: "#c9c9c9" }}>Display name</label>
            <input id="ep-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" className={INPUT} />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="ep-username" className="text-[13px]" style={{ color: "#c9c9c9" }}>Username</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px]" style={{ color: "var(--text-muted)" }} aria-hidden="true">@</span>
              <input
                id="ep-username"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s/g, "").toLowerCase())}
                disabled={!!nextUsernameChange}
                className={`${INPUT} pl-8 disabled:opacity-60`}
              />
            </div>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {nextUsernameChange
                ? `You can change your username again on ${nextUsernameChange.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.`
                : `You can change your username once every ${USERNAME_COOLDOWN_DAYS} days.`}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between">
              <label htmlFor="ep-bio" className="text-[13px]" style={{ color: "#c9c9c9" }}>Bio</label>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{bio.length} characters</span>
            </div>
            <textarea
              id="ep-bio"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A line about what you collect or create"
              className={`${INPUT} h-auto py-3 resize-y`}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="ep-contact" className="text-[13px]" style={{ color: "#c9c9c9" }}>
              Contact number <span style={{ color: "var(--text-muted)" }}>· optional</span>
            </label>
            <input id="ep-contact" type="tel" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="+91 98765 43210" autoComplete="tel" className={INPUT} />
          </div>

          <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl" style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.06)" }}>
            <MailIcon size={16} strokeWidth={2} stroke="#9a9a9a" aria-hidden="true" />
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-sm truncate">{profile.email}</span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>Email can’t be changed</span>
            </div>
            <Link href="/settings" className="ml-auto text-[13px] underline underline-offset-[3px] whitespace-nowrap" style={{ color: "#c9c9c9" }}>
              Sign-in settings
            </Link>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-6 sm:px-7 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{dirty ? "Unsaved changes" : "No changes yet"}</span>
          <div className="flex gap-2.5">
            <button type="button" onClick={requestClose} className="h-11 px-[18px] rounded-full text-sm font-medium border border-white/[0.14] transition-colors hover:bg-white/[0.04]" style={{ color: "#e5e5e5" }}>
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving}
              className="h-11 px-[22px] rounded-full text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
