"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  deleteAdminUser,
  disableUser,
  enableUser,
  getAdminUser,
  listAdminUsers,
  setUserCreator,
  unlockUser,
  type AdminUser,
  type AdminUserDetail,
  type UserFilters,
} from "@/lib/adminApi";
import { useToast } from "@/lib/toast";
import { Modal, StatusBadge, Toggle, inputStyle } from "../_components/ui";

const PAGE = 50;
const fmt = (n: number) => new Intl.NumberFormat("en-IN").format(n);
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");
/** Exact time in the admin's own time zone, e.g. "Sat, 17 Oct 2026, 9:45 PM". */
const exact = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day}, ${time}`;
};

const ago = (iso: string | null) => {
  if (!iso) return "—";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return date(iso);
};

const SORTS: { value: NonNullable<UserFilters["sort"]>; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "uploads", label: "Most uploads" },
  { value: "downloads", label: "Most downloads" },
  { value: "likes", label: "Most likes" },
  { value: "name", label: "Name A–Z" },
];

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "accent" | "warn" | "danger" | "info" }) {
  const t = {
    neutral: { bg: "rgba(255,255,255,0.06)", fg: "var(--text-secondary)" },
    accent: { bg: "rgba(129,238,78,0.12)", fg: "var(--accent)" },
    warn: { bg: "rgba(245,158,11,0.14)", fg: "#f59e0b" },
    danger: { bg: "rgba(239,68,68,0.14)", fg: "#ef4444" },
    info: { bg: "rgba(57,135,229,0.16)", fg: "#6aa8ef" },
  }[tone];
  return <span className="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: t.bg, color: t.fg }}>{children}</span>;
}

function Avatar({ u, size = 32 }: { u: Pick<AdminUser, "avatarUrl" | "displayName">; size?: number }) {
  return u.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={u.avatarUrl} alt="" width={size} height={size} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
  ) : (
    <span className="rounded-full shrink-0 flex items-center justify-center font-semibold" style={{ width: size, height: size, fontSize: size * 0.4, background: "var(--accent)", color: "var(--bg-primary)" }}>
      {u.displayName.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={null}>
      <UsersManager />
    </Suspense>
  );
}

function UsersManager() {
  // ?q= lets other pages (e.g. the activity log) link straight to a user
  const initialQ = useSearchParams().get("q") ?? "";
  const [filters, setFilters] = useState<UserFilters>({ role: "all", sort: "newest", q: initialQ || undefined });
  const [qDraft, setQDraft] = useState(initialQ);
  const [rows, setRows] = useState<AdminUser[] | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  // debounce the search box into the filters
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.q === (qDraft.trim() || undefined) ? f : { ...f, q: qDraft.trim() || undefined })), 300);
    return () => clearTimeout(t);
  }, [qDraft]);

  const apply = useCallback((page: { data: AdminUser[]; total: number; hasMore: boolean }, append: boolean) => {
    setError("");
    setRows((prev) => (append && prev ? [...prev, ...page.data] : page.data));
    setTotal(page.total);
    setHasMore(page.hasMore);
  }, []);
  const fail = (e: unknown) => setError(e instanceof Error ? e.message : "Failed to load");

  useEffect(() => {
    let alive = true;
    listAdminUsers({ ...filters, limit: PAGE, offset: 0 })
      .then((p) => { if (alive) apply(p, false); })
      .catch((e) => { if (alive) fail(e); });
    return () => { alive = false; };
  }, [filters, apply]);

  const loadMore = () => listAdminUsers({ ...filters, limit: PAGE, offset: rows?.length ?? 0 }).then((p) => apply(p, true)).catch(fail);

  const set = (patch: Partial<UserFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const chip = (on: boolean, label: string, onClick: () => void) => (
    <button
      onClick={onClick}
      aria-pressed={on}
      className="text-xs px-3 py-1.5 rounded-full"
      style={{ background: on ? "rgba(129,238,78,0.12)" : "transparent", border: `1px solid ${on ? "rgba(129,238,78,0.45)" : "var(--border-hover)"}`, color: on ? "var(--text-primary)" : "var(--text-secondary)" }}
    >
      {label}
    </button>
  );
  const activeFilters =
    [filters.q, filters.creator, filters.signIn, filters.locked].filter(Boolean).length +
    (filters.role !== "all" ? 1 : 0) +
    (filters.status && filters.status !== "all" ? 1 : 0);

  return (
    <div className="pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Users</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{rows ? `${fmt(total)} ${activeFilters ? "matching" : "accounts"}` : "Loading…"}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <input value={qDraft} onChange={(e) => setQDraft(e.target.value)} placeholder="Search email, username or name" aria-label="Search users" className="rounded-lg px-3 py-2 text-sm w-72 max-w-full" style={inputStyle} />
        <select aria-label="Role" value={filters.role} onChange={(e) => set({ role: e.target.value as UserFilters["role"] })} className="rounded-lg px-3 py-2 text-sm" style={inputStyle}>
          <option value="all">All roles</option>
          <option value="user">Users</option>
          <option value="admin">Admins</option>
        </select>
        <select aria-label="Account status" value={filters.status ?? "all"} onChange={(e) => set({ status: e.target.value as UserFilters["status"] })} className="rounded-lg px-3 py-2 text-sm" style={inputStyle}>
          <option value="all">All accounts</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
        <select aria-label="Sign-in method" value={filters.signIn ?? ""} onChange={(e) => set({ signIn: (e.target.value || undefined) as UserFilters["signIn"] })} className="rounded-lg px-3 py-2 text-sm" style={inputStyle}>
          <option value="">Any sign-in</option>
          <option value="google">Has Google</option>
          <option value="password">Has password</option>
          <option value="google-only">Google only</option>
          <option value="password-only">Password only</option>
        </select>
        {chip(filters.creator === "true", "Creators", () => set({ creator: filters.creator === "true" ? undefined : "true" }))}
        {chip(filters.locked === "true", "Locked", () => set({ locked: filters.locked === "true" ? undefined : "true" }))}
        <span className="flex-1" />
        <select aria-label="Sort" value={filters.sort} onChange={(e) => set({ sort: e.target.value as UserFilters["sort"] })} className="rounded-lg px-3 py-2 text-sm" style={inputStyle}>
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {activeFilters > 0 && (
          <button onClick={() => { setQDraft(""); setFilters({ role: "all", sort: filters.sort }); }} className="text-xs underline" style={{ color: "var(--text-secondary)" }}>
            Clear filters
          </button>
        )}
      </div>

      {error && <p className="mt-6 text-sm" style={{ color: "#ef4444" }}>{error}</p>}

      <div className="mt-4 rounded-xl overflow-x-auto" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)", background: "var(--bg-secondary)" }}>
              <th className="px-4 py-2.5 font-medium">User</th>
              <th className="px-3 py-2.5 font-medium">Sign-in</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium text-right">Uploads</th>
              <th className="px-3 py-2.5 font-medium text-right">Downloads</th>
              <th className="px-3 py-2.5 font-medium text-right">Likes</th>
              <th className="px-3 py-2.5 font-medium">Joined</th>
              <th className="px-3 py-2.5 font-medium">Last active</th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((u) => (
              <tr
                key={u.id}
                onClick={() => setOpenId(u.id)}
                className="cursor-pointer hover:bg-white/[0.03]"
                style={{ borderTop: "1px solid var(--border)", background: openId === u.id ? "rgba(129,238,78,0.05)" : undefined }}
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar u={u} />
                    <div className="min-w-0">
                      <p className="truncate" style={{ color: "var(--text-primary)" }}>{u.displayName} <span style={{ color: "var(--text-muted)" }}>@{u.username}</span></p>
                      <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1">
                    {u.hasGoogle && <Badge tone="info">Google</Badge>}
                    {u.hasPassword && <Badge>Password</Badge>}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {u.disabled && <Badge tone="danger">Disabled</Badge>}
                    {u.role === "admin" && <Badge tone="accent">Admin</Badge>}
                    {u.isCreator && <Badge tone="accent">Creator</Badge>}
                    {u.locked && <Badge tone="danger">Locked</Badge>}
                    {!u.isEmailVerified && <Badge tone="warn">Unverified</Badge>}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: "var(--text-secondary)" }}>{fmt(u.uploads)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: "var(--text-secondary)" }}>{fmt(u.downloads)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: "var(--text-secondary)" }}>{fmt(u.likes)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{date(u.createdAt)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--text-secondary)" }} title={u.lastActiveAt ? ago(u.lastActiveAt) : undefined}>
                  {exact(u.lastActiveAt)}
                </td>
              </tr>
            ))}
            {rows && rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center" style={{ color: "var(--text-muted)" }}>No users match.</td></tr>
            )}
            {!rows && !error && Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--border)" }}><td colSpan={8} className="px-4 py-3"><div className="h-8 rounded animate-pulse" style={{ background: "var(--bg-secondary)" }} /></td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <div className="mt-4 flex justify-center">
          <button onClick={loadMore} className="text-sm px-4 py-2 rounded-lg hover:bg-white/5" style={{ border: "1px solid var(--border-hover)", color: "var(--text-primary)" }}>
            Load more
          </button>
        </div>
      )}

      {openId && (
        <UserDrawer
          key={openId}
          id={openId}
          onClose={() => setOpenId(null)}
          onChanged={(u) => setRows((prev) => prev?.map((r) => (r.id === u.id ? { ...r, ...u } : r)) ?? prev)}
          onDeleted={(id) => { setOpenId(null); setRows((prev) => prev?.filter((r) => r.id !== id) ?? prev); setTotal((t) => t - 1); }}
        />
      )}
    </div>
  );
}

const ACTION_LABEL: Record<string, string> = {
  "user.creator.grant": "Made creator",
  "user.creator.revoke": "Removed creator",
  "creator.application.approve": "Approved creator application",
  "creator.application.reject": "Rejected creator application",
  "user.unlock": "Unlocked sign-in",
  "user.disable": "Disabled account",
  "user.enable": "Re-enabled account",
};

function UserDrawer({ id, onClose, onChanged, onDeleted }: {
  id: string;
  onClose: () => void;
  onChanged: (u: AdminUserDetail) => void;
  onDeleted: (id: string) => void;
}) {
  const { toast } = useToast();
  const [u, setU] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [disabling, setDisabling] = useState(false);

  useEffect(() => {
    let alive = true;
    getAdminUser(id)
      .then((d) => { if (alive) { setU(d); setError(""); } })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Failed to load"); });
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !deleting && !disabling) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, deleting, disabling]);

  const run = async (fn: () => Promise<AdminUserDetail>, msg: string) => {
    setBusy(true);
    try {
      const next = await fn();
      setU(next);
      onChanged(next);
      toast(msg, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const protectedAccount = u?.role === "admin";

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose} />
      <aside
        className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[520px] flex flex-col"
        style={{ background: "var(--bg-secondary)", borderLeft: "1px solid var(--border-hover)", boxShadow: "-16px 0 48px rgba(0,0,0,0.4)" }}
        aria-label="User details"
      >
        <div className="flex items-center justify-between px-5 h-14 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="font-semibold" style={{ color: "var(--text-primary)" }}>User</p>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5" style={{ color: "var(--text-secondary)" }} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-6">
          {error && <p className="text-sm" style={{ color: "#ef4444" }}>{error}</p>}
          {!u && !error && <div className="h-40 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />}
          {u && (
            <>
              <div className="flex items-start gap-4">
                <Avatar u={u} size={56} />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold truncate" style={{ color: "var(--text-primary)" }}>{u.displayName}</p>
                  <p className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>@{u.username} · {u.email}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {u.disabled && <Badge tone="danger">Disabled</Badge>}
                    {u.role === "admin" && <Badge tone="accent">Admin</Badge>}
                    {u.isCreator && <Badge tone="accent">Creator</Badge>}
                    {u.hasGoogle && <Badge tone="info">Google</Badge>}
                    {u.hasPassword && <Badge>Password</Badge>}
                    {u.isEmailVerified ? <Badge>Email verified</Badge> : <Badge tone="warn">Email not verified</Badge>}
                    {u.locked && <Badge tone="danger">Locked until {new Date(u.lockedUntil!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Badge>}
                  </div>
                </div>
              </div>

              {u.disabled && (
                <div className="rounded-lg p-3 text-xs flex flex-col gap-1" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.35)", color: "var(--text-secondary)" }}>
                  <p className="text-sm font-semibold" style={{ color: "#ef4444" }}>Account disabled</p>
                  <p>Reason: <span style={{ color: "var(--text-primary)" }}>{u.disabledReason}</span></p>
                  <p>{date(u.disabledAt)}{u.disabledByEmail ? ` by ${u.disabledByEmail}` : ""} · {fmt(u.hiddenUploads)} wallpaper{u.hiddenUploads === 1 ? "" : "s"} hidden</p>
                  <p>They can&apos;t sign in and their sessions don&apos;t work.</p>
                </div>
              )}

              <dl className="grid grid-cols-3 gap-2">
                {[
                  ["Uploads", u.uploads], ["Downloads", u.downloads], ["Likes", u.likes],
                  ["Collections", u.collections], ["Failed logins", u.failedLoginAttempts], ["Joined", date(u.createdAt)],
                ].map(([k, v]) => (
                  <div key={k as string} className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                    <dt className="text-[11px]" style={{ color: "var(--text-muted)" }}>{k}</dt>
                    <dd className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{typeof v === "number" ? fmt(v) : v}</dd>
                  </div>
                ))}
              </dl>

              <section className="flex flex-col gap-2">
                <h3 className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Actions</h3>
                {protectedAccount ? (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Admin accounts are managed with the admin script, not from here.</p>
                ) : (
                  <>
                    <Toggle
                      label="Creator (can upload wallpapers)"
                      checked={u.isCreator}
                      disabled={busy || u.disabled}
                      onChange={(v) => run(() => setUserCreator(u.id, v), v ? "Now a creator." : "No longer a creator.")}
                    />
                    <div className="flex flex-wrap gap-2 mt-1">
                      {(u.locked || u.failedLoginAttempts > 0) && !u.disabled && (
                        <button
                          disabled={busy}
                          onClick={() => run(() => unlockUser(u.id), u.locked ? "Sign-in unlocked." : "Failed logins reset.")}
                          className="text-xs px-3 py-2 rounded-lg hover:bg-white/5 disabled:opacity-40"
                          style={{ border: "1px solid var(--border-hover)", color: "var(--text-primary)" }}
                          title={u.locked ? "Locked after 5 wrong passwords — end the 15-minute lock now" : `${u.failedLoginAttempts} wrong password${u.failedLoginAttempts === 1 ? "" : "s"} recently — 5 locks the account for 15 minutes`}
                        >
                          {u.locked ? "Unlock sign-in" : `Reset failed logins (${u.failedLoginAttempts})`}
                        </button>
                      )}
                      {u.disabled ? (
                        <button
                          disabled={busy}
                          onClick={() => run(() => enableUser(u.id), "Account re-enabled — wallpapers are live again.")}
                          className="text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-40"
                          style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
                        >
                          Re-enable account
                        </button>
                      ) : (
                        <button
                          disabled={busy}
                          onClick={() => setDisabling(true)}
                          className="text-xs px-3 py-2 rounded-lg hover:bg-white/5 disabled:opacity-40"
                          style={{ border: "1px solid rgba(245,158,11,0.5)", color: "#f59e0b" }}
                        >
                          Disable account…
                        </button>
                      )}
                      <button
                        disabled={busy}
                        onClick={() => setDeleting(true)}
                        className="text-xs px-3 py-2 rounded-lg hover:bg-white/5 disabled:opacity-40"
                        style={{ border: "1px solid rgba(239,68,68,0.45)", color: "#ef4444" }}
                      >
                        Delete account…
                      </button>
                    </div>
                  </>
                )}
              </section>

              {u.recentUploads.length > 0 && (
                <section className="flex flex-col gap-2">
                  <h3 className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Uploads ({fmt(u.uploads)})</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {u.recentUploads.map((w) => (
                      <div key={w.id} className="rounded-md overflow-hidden" style={{ background: w.dominantColor }} title={`${w.title} · ${w.category ?? "No category"}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={w.fileUrl} alt={w.title} loading="lazy" className="w-full object-cover" style={{ aspectRatio: "16 / 10" }} />
                        <div className="px-1.5 py-1 flex items-center justify-between gap-1" style={{ background: "rgba(0,0,0,0.55)" }}>
                          <span className="text-[10px] truncate" style={{ color: "#fff" }}>{w.title}</span>
                          <StatusBadge status={w.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="flex flex-col gap-2">
                <h3 className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Recent downloads</h3>
                {u.recentDownloads.length === 0 ? (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>None yet.</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {u.recentDownloads.map((d, i) => (
                      <li key={`${d.wallpaperId}-${i}`} className="flex items-center gap-2 text-xs">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={d.fileUrl} alt="" loading="lazy" className="w-10 h-7 rounded object-cover shrink-0" style={{ background: d.dominantColor }} />
                        <span className="truncate flex-1" style={{ color: "var(--text-primary)" }}>{d.title}</span>
                        <span style={{ color: "var(--text-muted)" }}>{d.source} · {ago(d.at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {u.recentLikes.length > 0 && (
                <section className="flex flex-col gap-2">
                  <h3 className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Recent likes</h3>
                  <div className="flex gap-1.5 flex-wrap">
                    {u.recentLikes.map((l) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={l.wallpaperId} src={l.fileUrl} alt={l.title} title={`${l.title} · ${ago(l.at)}`} loading="lazy" className="w-14 h-10 rounded object-cover" style={{ background: l.dominantColor }} />
                    ))}
                  </div>
                </section>
              )}

              {u.history.length > 0 && (
                <section className="flex flex-col gap-2">
                  <h3 className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Admin history</h3>
                  <ul className="flex flex-col gap-1 text-xs">
                    {u.history.map((h, i) => (
                      <li key={i} className="flex justify-between gap-3">
                        <span style={{ color: "var(--text-primary)" }}>{ACTION_LABEL[h.action] ?? h.action}</span>
                        <span style={{ color: "var(--text-muted)" }}>{h.adminEmail ?? "system"} · {ago(h.at)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </aside>

      {disabling && u && (
        <DisableUserDialog
          user={u}
          onCancel={() => setDisabling(false)}
          onDone={(next) => { setDisabling(false); setU(next); onChanged(next); toast(`Disabled ${next.email}${next.hiddenUploads ? ` — ${next.hiddenUploads} wallpaper${next.hiddenUploads === 1 ? "" : "s"} hidden` : ""}.`, "success"); }}
        />
      )}

      {deleting && u && (
        <DeleteUserDialog
          user={u}
          onCancel={() => setDeleting(false)}
          onDeleted={(removed) => {
            setDeleting(false);
            toast(`Deleted ${u.email}${removed ? ` and ${removed} upload${removed === 1 ? "" : "s"}` : ""}.`, "success");
            onDeleted(u.id);
          }}
        />
      )}
    </>
  );
}

function DisableUserDialog({ user, onCancel, onDone }: { user: AdminUserDetail; onCancel: () => void; onDone: (u: AdminUserDetail) => void }) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = reason.trim().length >= 3;

  const run = async () => {
    setBusy(true);
    try {
      onDone(await disableUser(user.id, reason.trim()));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to disable", "error");
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onCancel} busy={busy} width={480} labelledBy="dis-user-title">
      <p id="dis-user-title" className="font-semibold" style={{ color: "var(--text-primary)" }}>Disable {user.displayName}&apos;s account?</p>
      <ul className="list-disc pl-5 text-xs flex flex-col gap-0.5" style={{ color: "var(--text-secondary)" }}>
        <li>They can&apos;t sign in (password, code or Google) and any open session stops working.</li>
        <li>{user.liveUploads > 0 ? <><b>{fmt(user.liveUploads)} live wallpaper{user.liveUploads === 1 ? "" : "s"}</b> will be hidden from the site.</> : "They have no live wallpapers."}</li>
        <li>Nothing is deleted — re-enabling restores the account and its wallpapers.</li>
      </ul>
      <label className="flex flex-col gap-1">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>Reason (kept in the activity log)</span>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={2} autoFocus placeholder="e.g. Uploading copyrighted art" className="rounded-lg px-3 py-2 text-sm resize-y" style={inputStyle} />
      </label>
      <div className="flex justify-end gap-2">
        <button disabled={busy} onClick={onCancel} className="text-sm px-4 py-2 rounded-lg hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>Cancel</button>
        <button disabled={busy || !ok} onClick={run} className="text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-40" style={{ background: "#f59e0b", color: "#111" }}>
          {busy ? "Disabling…" : "Disable account"}
        </button>
      </div>
    </Modal>
  );
}

function DeleteUserDialog({ user, onCancel, onDeleted }: { user: AdminUserDetail; onCancel: () => void; onDeleted: (uploadsRemoved: number) => void }) {
  const { toast } = useToast();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const matches = typed.trim().toLowerCase() === user.email.toLowerCase();

  const run = async () => {
    setBusy(true);
    try {
      const r = await deleteAdminUser(user.id, typed);
      onDeleted(r.uploadsRemoved);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete", "error");
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onCancel} busy={busy} width={480} labelledBy="del-user-title">
      <p id="del-user-title" className="font-semibold" style={{ color: "var(--text-primary)" }}>Delete {user.displayName}&apos;s account?</p>
      <div className="text-sm flex flex-col gap-1" style={{ color: "var(--text-secondary)" }}>
        <p>This can&apos;t be undone. It permanently removes:</p>
        <ul className="list-disc pl-5 text-xs flex flex-col gap-0.5">
          <li>the account, profile picture and cover</li>
          {user.uploads > 0 && <li><b style={{ color: "#ef4444" }}>{fmt(user.uploads)} uploaded wallpaper{user.uploads === 1 ? "" : "s"}</b> and their files</li>}
          <li>{fmt(user.likes)} likes and {fmt(user.collections)} collections</li>
        </ul>
        <p className="text-xs">Their download history is kept without their name, so site stats stay correct.</p>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>Type <b style={{ color: "var(--text-primary)" }}>{user.email}</b> to confirm</span>
        <input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus autoComplete="off" className="rounded-lg px-3 py-2 text-sm" style={inputStyle} aria-label="Confirm email" />
      </label>
      <div className="flex justify-end gap-2">
        <button disabled={busy} onClick={onCancel} className="text-sm px-4 py-2 rounded-lg hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>Cancel</button>
        <button disabled={busy || !matches} onClick={run} className="text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-40" style={{ background: "#ef4444", color: "#fff" }}>
          {busy ? "Deleting…" : "Delete account"}
        </button>
      </div>
    </Modal>
  );
}
