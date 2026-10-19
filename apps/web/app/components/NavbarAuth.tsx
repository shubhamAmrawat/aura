"use client";

import Link from "next/link";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import AvatarImage from "@/app/components/AvatarImage";
import { ConfirmDialog } from "@/app/admin/_components/ui";
import { ChevronDownIcon, LockIcon, LogOutIcon, PlusIcon, UserIcon } from "lucide-react";

const NavbarAuth = () => {
  const router = useRouter();
  const { user, logout, loaded } = useAuth();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    setConfirmLogout(false);
    router.push("/login");
    router.refresh();
    setLoggingOut(false);
  };

  if (!loaded) {
    return <div className="w-8 h-8 rounded-full animate-pulse" style={{ background: "var(--bg-elevated)" }} />;
  }

  if (!user) {
    return (
      <Link
        href="/login"
        title="Sign in"
        aria-label="Sign in"
        className="flex h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold transition-opacity hover:opacity-85 sm:px-4"
        style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
      >
       
        <UserIcon size={16} strokeWidth={1.75} aria-hidden />
        <span className="hidden sm:inline">Sign in</span>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {user?.isCreator && (
        <Link
          href="/upload"
          className="flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors hover:bg-white/[0.06] sm:px-4"
          style={{ color: "var(--text-primary)", border: "1px solid var(--border-hover)" }}
          title="Upload wallpaper"
        >
          <PlusIcon size={13} strokeWidth={2.5} aria-hidden="true" />
          <span className="hidden sm:inline">Upload</span>
        </Link>
      )}
      <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
      >
        <AvatarImage
          src={user.avatarUrl}
          alt={user.displayName || "Avatar"}
          className="w-8 h-8 rounded-full object-cover"
          fallback={
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
            >
              {user.displayName?.[0]?.toUpperCase()}
            </div>
          }
        />
        <ChevronDownIcon size={12} strokeWidth={2} className="transition-transform duration-200" style={{
            color: "var(--text-muted)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }} aria-hidden="true" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-12 z-50 w-56 rounded-xl overflow-hidden py-1"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
            }}
          >
            <div className="px-4 py-3.5 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <AvatarImage
                src={user.avatarUrl}
                alt={user.displayName || "Avatar"}
                className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                fallback={
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
                  >
                    {user.displayName?.[0]?.toUpperCase()}
                  </div>
                }
              />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                  {user.displayName}
                </p>
                <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                  @{user.username}
                </p>
              </div>
            </div>

            <div className="py-1">
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-white/5"
                style={{ color: "var(--text-secondary)" }}
              >
                <UserIcon size={14} strokeWidth={2} aria-hidden="true" />
                Profile
              </Link>
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-white/5"
                style={{ color: "var(--text-secondary)" }}
              >
                <LockIcon size={14} strokeWidth={2} aria-hidden="true" />
                Account settings
              </Link>
              {/* <Link
                href="/collection"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-white/5"
                style={{ color: "var(--text-secondary)" }}
              >
                <LayoutGridIcon size={14} strokeWidth={2} aria-hidden="true" />
                Collections
              </Link> */}
            </div>

            <div className="py-1" style={{ borderTop: "1px solid var(--border)" }}>
              <button
                onClick={() => { setOpen(false); setConfirmLogout(true); }}
                className="flex items-center gap-3 px-4 py-2.5 text-sm w-full text-left transition-colors hover:bg-white/5"
                style={{ color: "#ef4444" }}
              >
                <LogOutIcon size={14} strokeWidth={2} aria-hidden="true" />
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
      </div>

      {/* Portal: the navbar uses backdrop-blur, which would trap a fixed overlay inside it. */}
      {confirmLogout && createPortal(
        <ConfirmDialog
          title="Sign out?"
          body="You’ll need to sign in again to see your likes and collections."
          confirmLabel="Sign out"
          danger
          busy={loggingOut}
          onCancel={() => setConfirmLogout(false)}
          onConfirm={() => void handleLogout()}
        />,
        document.body,
      )}
    </div>
  );
};

export default NavbarAuth;
