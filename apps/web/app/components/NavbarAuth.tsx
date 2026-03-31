"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/authApi";
import { User } from "@aura/types";
import { clearToken } from "@/lib/token";

interface NavbarAuthProps {
  user: User | null;
}

const NavbarAuth = ({ user }: NavbarAuthProps) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const handleLogout = async () => {
    setLoggingOut(true);
    clearToken(); // clear from localStorage
    await logout();
    router.push("/");
    router.refresh();
  };

  if (!user) {
    return (
      <Link
        href="/login"
        className="text-sm font-medium px-6 py-2 border transition-all duration-200 hover:opacity-80 tracking-wider"
        style={{
          borderColor: 'var(--accent)',
          color: 'var(--accent)',
        }}
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 transition-opacity hover:opacity-80"
      >
        {/* avatar */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
          style={{
            background: "var(--accent)",
            color: "var(--bg-primary)",
          }}
        >
          {user.displayName?.[0]?.toUpperCase()}
        </div>
      </button>

      {/* dropdown */}
      {open && (
        <>
          {/* backdrop to close on outside click */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute right-0 top-12 z-50 w-52 rounded-xl overflow-hidden py-1"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
          >
            {/* user info */}
            <div
              className="px-4 py-3"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <p
                className="text-sm font-medium truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {user.displayName}
              </p>
              <p
                className="text-xs truncate mt-0.5"
                style={{ color: "var(--text-muted)" }}
              >
                @{user.username}
              </p>
            </div>

            {/* links */}
            <div className="py-1">
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-white/5"
                style={{ color: "var(--text-secondary)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                Profile
              </Link>

              <Link
                href="/collections"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-white/5"
                style={{ color: "var(--text-secondary)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                </svg>
                Collections
              </Link>
            </div>

            {/* logout */}
            <div
              className="py-1"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-2.5 text-sm w-full text-left transition-colors hover:bg-white/5"
                style={{ color: "#ef4444" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                 {loggingOut ? "Signing out..." : "Sign out"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NavbarAuth;