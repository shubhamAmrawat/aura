"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/authContext";
import Logo from "@/app/components/Logo";
import AvatarImage from "@/app/components/AvatarImage";

type NavItem = { href: string; label: string; icon: React.ReactNode; soon?: boolean };

const icon = (d: React.ReactNode) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);

const logoutIcon = icon(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>);

const NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: icon(<><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>) },
  { href: "/admin/review", label: "Review queue", icon: icon(<><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>) },
  { href: "/admin/wallpapers", label: "Wallpapers", icon: icon(<><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></>) },
  { href: "/admin/featured", label: "Featured", icon: icon(<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />) },
  { href: "/admin/upload", label: "Bulk upload", icon: icon(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>) },
  { href: "/admin/categories", label: "Categories", icon: icon(<><path d="M4 4h6v6H4z" /><path d="M14 4h6v6h-6z" /><path d="M4 14h6v6H4z" /><path d="M14 14h6v6h-6z" /></>) },
  { href: "/admin/users", label: "Users", icon: icon(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>) },
  { href: "/admin/activity", label: "Activity log", icon: icon(<><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>) },
  {
    href: "/admin/ai-generator",
    label: "AI generator",
    icon: icon(<><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></>),
  },
];

/**
 * Admin chrome. Access is enforced before this renders (middleware → 404 for non-admins)
 * and by the API on every call; this only covers a session that changes while the page is open.
 */
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, loaded, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const isAdmin = user?.role === "admin";
  const loggingOut = useRef(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (loaded && !isAdmin && !loggingOut.current) router.replace("/");
  }, [loaded, isAdmin, router]);

  const handleLogout = async () => {
    setSigningOut(true);
    loggingOut.current = true;
    await logout();
    // Full page load so the middleware sees the cleared cookie.
    window.location.replace("/login");
  };

  if (!loaded || !user || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "var(--border-hover)", borderTopColor: "var(--accent)" }} />
      </div>
    );
  }

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  const nav = (
    <nav className="flex flex-col gap-0.5">
      {NAV.map((item) =>
        item.soon ? (
          <span
            key={item.href}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm cursor-default"
            style={{ color: "var(--text-muted)" }}
          >
            {item.icon}
            <span className="flex-1">{item.label}</span>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ border: "1px solid var(--border-hover)" }}>
              Soon
            </span>
          </span>
        ) : (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/5"
            style={{
              color: isActive(item.href) ? "var(--text-primary)" : "var(--text-secondary)",
              background: isActive(item.href) ? "rgba(129,238,78,0.10)" : undefined,
            }}
          >
            <span style={{ color: isActive(item.href) ? "var(--accent)" : undefined }}>{item.icon}</span>
            {item.label}
          </Link>
        )
      )}
    </nav>
  );

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg-primary)" }}>
      {/* Sidebar (desktop) */}
      <aside
        className="hidden md:flex w-60 shrink-0 flex-col gap-6 p-4 sticky top-0 h-screen"
        style={{ borderRight: "1px solid var(--border)", background: "var(--bg-secondary)" }}
      >
        <div className="flex items-center gap-2 px-2 pt-1">
          <Logo size={28} href="/admin" />
          <span className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded" style={{ color: "var(--accent)", border: "1px solid rgba(129,238,78,0.35)" }}>
            Admin
          </span>
        </div>
        {nav}
        <div className="mt-auto flex items-center gap-2.5 px-2">
          <AvatarImage
            src={user.avatarUrl}
            alt={user.displayName}
            className="w-8 h-8 rounded-full object-cover"
            fallback={
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>
                {user.displayName?.[0]?.toUpperCase()}
              </div>
            }
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{user.displayName}</p>
            <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{user.email}</p>
          </div>
          <button
            onClick={() => setConfirmLogout(true)}
            className="p-2 rounded-lg transition-colors hover:bg-white/5"
            style={{ color: "var(--text-secondary)" }}
            title="Log out"
            aria-label="Log out"
          >
            {logoutIcon}
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar (mobile) */}
        <header
          className="md:hidden flex items-center justify-between px-4 h-14 sticky top-0 z-30"
          style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <Logo size={26} href="/admin" />
            <span className="text-[10px] uppercase tracking-widest" style={{ color: "var(--accent)" }}>Admin</span>
          </div>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-2 rounded-lg hover:bg-white/5"
            style={{ color: "var(--text-secondary)" }}
            aria-label="Menu"
          >
            {icon(<><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>)}
          </button>
        </header>
        {menuOpen && (
          <div className="md:hidden px-4 py-3" style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
            {nav}
            <button
              onClick={() => setConfirmLogout(true)}
              className="flex items-center gap-3 w-full px-3 py-2 mt-2 rounded-lg text-sm hover:bg-white/5"
              style={{ color: "var(--text-secondary)" }}
            >
              {logoutIcon}
              Log out
            </button>
          </div>
        )}

        <main className="flex-1 px-4 md:px-8 py-6 md:py-8 w-full">{children}</main>
      </div>

      {confirmLogout && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => !signingOut && setConfirmLogout(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-title"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === "Escape" && !signingOut && setConfirmLogout(false)}
            className="w-[min(380px,92vw)] rounded-xl p-5 flex flex-col gap-4"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-hover)", boxShadow: "0 16px 48px rgba(0,0,0,0.5)" }}
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>
                {logoutIcon}
              </div>
              <div>
                <p id="logout-title" className="font-semibold" style={{ color: "var(--text-primary)" }}>Log out?</p>
                <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                  You&apos;ll be signed out of the admin dashboard on this browser.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                autoFocus
                disabled={signingOut}
                onClick={() => setConfirmLogout(false)}
                className="text-sm px-3 py-2 rounded-lg hover:bg-white/5 disabled:opacity-40"
                style={{ color: "var(--text-secondary)" }}
              >
                Cancel
              </button>
              <button
                disabled={signingOut}
                onClick={() => void handleLogout()}
                className="text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
                style={{ background: "#ef4444", color: "#fff" }}
              >
                {signingOut ? "Logging out…" : "Log out"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
