"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/authContext";
import Logo from "@/app/components/Logo";
import AvatarImage from "@/app/components/AvatarImage";
import { CREATOR_APPS_CHANGED, getCreatorApplicationCounts, getReportCounts, REPORTS_CHANGED } from "@/lib/adminApi";
import { ClockIcon, FlagIcon, ImageIcon, LayoutDashboardIcon, LogOutIcon, MenuIcon, ShapesIcon, SparklesIcon, SquareCheckBigIcon, StarIcon, UploadIcon, UserCheckIcon, UsersIcon, type LucideIcon } from "lucide-react";

type NavItem = { href: string; label: string; icon: React.ReactNode; soon?: boolean; badge?: "creatorApps" | "reports" };

const icon = (Icon: LucideIcon) => <Icon size={16} strokeWidth={2} aria-hidden="true" />;

const logoutIcon = icon(LogOutIcon);

const NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: icon(LayoutDashboardIcon) },
  { href: "/admin/review", label: "Review queue", icon: icon(SquareCheckBigIcon) },
  {
    href: "/admin/creator-applications",
    label: "Applications",
    badge: "creatorApps",
    icon: icon(UserCheckIcon),
  },
  { href: "/admin/reports", label: "Reports", badge: "reports", icon: icon(FlagIcon) },
  { href: "/admin/wallpapers", label: "Wallpapers", icon: icon(ImageIcon) },
  { href: "/admin/featured", label: "Featured", icon: icon(StarIcon) },
  { href: "/admin/upload", label: "Bulk upload", icon: icon(UploadIcon) },
  { href: "/admin/categories", label: "Categories", icon: icon(ShapesIcon) },
  { href: "/admin/users", label: "Users", icon: icon(UsersIcon) },
  { href: "/admin/activity", label: "Activity log", icon: icon(ClockIcon) },
  {
    href: "/admin/ai-generator",
    label: "AI generator",
    icon: icon(SparklesIcon),
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

  // Waiting creator applications → badge on the sidebar item (refreshed on navigation and after a decision).
  const [waitingApps, setWaitingApps] = useState(0);
  useEffect(() => {
    if (!isAdmin) return;
    const load = () => getCreatorApplicationCounts().then((c) => setWaitingApps(c.pending)).catch(() => undefined);
    load();
    window.addEventListener(CREATOR_APPS_CHANGED, load);
    return () => window.removeEventListener(CREATOR_APPS_CHANGED, load);
  }, [isAdmin, pathname]);

  // Open reports → badge on "Reports".
  const [openReports, setOpenReports] = useState(0);
  useEffect(() => {
    if (!isAdmin) return;
    const load = () => getReportCounts().then((c) => setOpenReports(c.open)).catch(() => undefined);
    load();
    window.addEventListener(REPORTS_CHANGED, load);
    return () => window.removeEventListener(REPORTS_CHANGED, load);
  }, [isAdmin, pathname]);
  const badgeCount = (b: NavItem["badge"]) => (b === "creatorApps" ? waitingApps : b === "reports" ? openReports : 0);

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
            <span className="flex-1">{item.label}</span>
            {item.badge && badgeCount(item.badge) > 0 && (
              <span
                className="min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center tabular-nums"
                style={item.badge === "reports" ? { background: "#ef4444", color: "#fff" } : { background: "var(--accent)", color: "var(--bg-primary)" }}
                aria-label={`${badgeCount(item.badge)} ${item.badge === "reports" ? "open" : "waiting"}`}
              >
                {badgeCount(item.badge)}
              </span>
            )}
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
          <Logo height={22} href="/admin" />
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
            <Logo height={20} href="/admin" />
            <span className="text-[10px] uppercase tracking-widest" style={{ color: "var(--accent)" }}>Admin</span>
          </div>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-2 rounded-lg hover:bg-white/5"
            style={{ color: "var(--text-secondary)" }}
            aria-label="Menu"
          >
            {icon(MenuIcon)}
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
