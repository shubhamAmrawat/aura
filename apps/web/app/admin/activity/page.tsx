"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listActivity, type ActivityEntry, type ActivityFilters, type ActivityGroup, type ActivityPage } from "@/lib/adminApi";
import { inputStyle } from "../_components/ui";

const PAGE = 50;
const GROUPS: { v: ActivityGroup; label: string; color: string }[] = [
  { v: "wallpapers", label: "Wallpapers", color: "#3987e5" },
  { v: "review", label: "Review", color: "#eab308" },
  { v: "categories", label: "Categories", color: "#a78bfa" },
  { v: "featured", label: "Featured", color: "#81ee4e" },
  { v: "users", label: "Users", color: "#d95926" },
  { v: "system", label: "System", color: "#94a3b8" },
];
const groupOf = (action: string): ActivityGroup => {
  if (["wallpaper.approve", "wallpaper.reject", "wallpaper.restore", "wallpaper.purge"].includes(action)) return "review";
  if (action.startsWith("wallpaper.")) return "wallpapers";
  if (action.startsWith("category.")) return "categories";
  if (action.startsWith("featured.")) return "featured";
  if (action.startsWith("user.role.")) return "system";
  if (action.startsWith("user.")) return "users";
  return "system";
};
const colorOf = (action: string) => GROUPS.find((g) => g.v === groupOf(action))!.color;

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const dayKey = (iso: string) => new Date(iso).toDateString();
const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};
const n = (v: unknown) => new Intl.NumberFormat("en-IN").format(Number(v) || 0);
const plural = (v: unknown, word: string) => `${n(v)} ${word}${Number(v) === 1 ? "" : "s"}`;

const FIELD: Record<string, string> = {
  title: "title", description: "description", tags: "tags", categoryId: "category",
  isFeatured: "featured", isPremium: "premium", isMobile: "mobile", isAiGenerated: "AI", name: "name", slug: "slug", coverImageUrl: "cover",
};

/** One plain sentence per entry. Names come from the live target when it still exists, else from the details. */
function describe(e: ActivityEntry): React.ReactNode {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- details are free-form JSON written by many actions
  const d = (e.details ?? {}) as Record<string, any>;
  const wp = <b>“{e.wallpaper?.title ?? d.title ?? "a wallpaper"}”</b>;
  const cat = <b>{e.category?.name ?? d.name ?? "a category"}</b>;
  const usr = <b>{e.user?.email ?? d.email ?? "a user"}</b>;
  switch (e.action) {
    case "wallpaper.update": {
      const keys = Object.keys(d.changes ?? {});
      const parts = keys.map((k) => {
        const c = d.changes[k];
        if (typeof c?.to === "boolean") return `${FIELD[k] ?? k} ${c.to ? "on" : "off"}`;
        return FIELD[k] ?? k;
      });
      return <>Edited {wp}{parts.length ? <> — {parts.join(", ")}</> : null}</>;
    }
    case "wallpaper.delete": return <>Deleted {wp}</>;
    case "wallpaper.upload": return <>Uploaded {wp} {d.published === false ? "(held for review)" : "(published)"}{d.autoCategory ? <> · AI filed it in {d.category}</> : null}</>;
    case "wallpaper.approve": return <>Approved {wp}</>;
    case "wallpaper.restore": return <>Restored {wp}</>;
    case "wallpaper.reject": return <>Rejected {wp}{d.reason ? <> — “{d.reason}”</> : null}</>;
    case "wallpaper.purge": return <>Auto-deleted rejected {wp}</>;
    case "category.create": return <>Created category {cat}</>;
    case "category.update": {
      const ch = d.changes ?? {};
      const bits = Object.keys(ch).map((k) => (k === "slug" || k === "name" ? `${FIELD[k]} ${ch[k].from} → ${ch[k].to}` : FIELD[k] ?? k));
      return <>Edited category {cat}{bits.length ? <> — {bits.join(", ")}</> : null}</>;
    }
    case "category.delete":
      return d.moveTo ? <>Merged <b>{d.name}</b> into <b>{d.moveToName ?? "another category"}</b> — {plural(d.moved, "wallpaper")} moved</> : <>Deleted category <b>{d.name}</b></>;
    case "category.reorder": return <>Reordered the categories</>;
    case "category.suggestions.apply": return <>Applied {plural(d.count, "AI category suggestion")}</>;
    case "category.suggestions.auto_apply": return <>Auto-filed {plural(d.count, "wallpaper")} into categories (AI)</>;
    case "category.suggestions.dismiss": return <>Dismissed {plural(d.count, "AI category suggestion")}</>;
    case "featured.reorder": return <>Reordered the featured wallpapers</>;
    case "featured.limit": return <>Home page now shows <b>{d.to}</b> featured wallpapers (was {d.from})</>;
    case "user.creator.grant": return <>Made {usr} a creator</>;
    case "user.creator.revoke": return <>Removed creator from {usr}</>;
    case "user.unlock": return <>Unlocked sign-in for {usr}</>;
    case "user.disable": return <>Disabled {usr} — “{d.reason}”{d.wallpapersHidden ? <> · {plural(d.wallpapersHidden, "wallpaper")} hidden</> : null}</>;
    case "user.enable": return <>Re-enabled {usr}{d.wallpapersRestored ? <> · {plural(d.wallpapersRestored, "wallpaper")} restored</> : null}</>;
    case "user.delete": return <>Deleted account <b>{d.email}</b>{d.uploadsRemoved ? <> and {plural(d.uploadsRemoved, "upload")}</> : null}</>;
    case "user.role.make_admin": return <>Made {usr} an admin</>;
    case "admin.create": return <>Created admin account <b>{d.email}</b></>;
    case "stats.reset": return <>Reset the wallpaper stats ({n(d.wallpapers)} wallpapers)</>;
    default: return <>{e.action}</>;
  }
}

/** Where "Open" goes for this entry, if anywhere useful. */
function targetHref(e: ActivityEntry): string | null {
  if (e.wallpaper) return `/admin/wallpapers?q=${encodeURIComponent(e.wallpaper.title)}`;
  if (e.user) return `/admin/users?q=${encodeURIComponent(e.user.email)}`;
  if (e.category || e.action.startsWith("category.")) return e.action.startsWith("category.suggestions") ? "/admin/categories/review" : "/admin/categories";
  if (e.action.startsWith("featured.")) return "/admin/featured";
  return null;
}

/** Readable details: change tables, reasons, counts; long id lists collapsed. */
function Details({ e, categoryNames }: { e: ActivityEntry; categoryNames: Record<string, string> }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- details are free-form JSON written by many actions
  const d = (e.details ?? {}) as Record<string, any>;
  const rows: [string, React.ReactNode][] = [];
  const fmtVal = (k: string, v: unknown) => {
    if (v === null || v === undefined || v === "") return <i style={{ color: "var(--text-muted)" }}>empty</i>;
    if (k === "categoryId" && typeof v === "string") return categoryNames[v] ?? "deleted category";
    if (Array.isArray(v)) return v.join(", ");
    if (typeof v === "boolean") return v ? "yes" : "no";
    return String(v);
  };
  if (d.changes && typeof d.changes === "object") {
    for (const [k, c] of Object.entries(d.changes as Record<string, { from: unknown; to: unknown }>)) {
      rows.push([FIELD[k] ?? k, <span key={k}>{fmtVal(k, c.from)} <span style={{ color: "var(--text-muted)" }}>→</span> {fmtVal(k, c.to)}</span>]);
    }
  }
  if (Array.isArray(d.moves)) {
    const byTarget = new Map<string, number>();
    for (const m of d.moves) byTarget.set(m.to, (byTarget.get(m.to) ?? 0) + 1);
    rows.push(["moved to", [...byTarget].sort((a, b) => b[1] - a[1]).map(([id, c]) => `${categoryNames[id] ?? "deleted category"} ${c}`).join(", ")]);
  }
  for (const [k, v] of Object.entries(d)) {
    if (["changes", "moves", "order", "ids", "title", "name"].includes(k)) continue;
    if (v === null || v === undefined || typeof v === "object") continue;
    if (typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(v)) continue; // raw ids: the names are shown instead
    rows.push([k === "moveToName" ? "moved into" : k.replace(/([A-Z])/g, " $1").toLowerCase(), String(v)]);
  }
  if (Array.isArray(d.order)) rows.push(["new order", `${d.order.length} items`]);
  rows.push(["when", new Date(e.createdAt).toLocaleString()]);
  rows.push(["by", e.admin?.email ?? "system"]);
  if (e.targetId) rows.push([e.targetType ?? "target", <code key="t" className="text-[11px]">{e.targetId}</code>]);

  return (
    <dl className="grid gap-x-4 gap-y-1 text-xs mt-2 px-3 py-2 rounded-lg" style={{ gridTemplateColumns: "max-content 1fr", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
      {rows.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt style={{ color: "var(--text-muted)" }}>{k}</dt>
          <dd className="break-words" style={{ color: "var(--text-secondary)" }}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function ActivityPage() {
  const [filters, setFilters] = useState<ActivityFilters>({});
  const [qDraft, setQDraft] = useState("");
  const [fromDay, setFromDay] = useState("");
  const [toDay, setToDay] = useState("");
  const [page, setPage] = useState<ActivityPage | null>(null);
  const [rows, setRows] = useState<ActivityEntry[]>([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, q: qDraft.trim() || undefined })), 300);
    return () => clearTimeout(t);
  }, [qDraft]);
  // date inputs are local days → exact instants (start of from-day, start of the day after to-day)
  const query = useMemo<ActivityFilters>(
    () => ({
      ...filters,
      from: fromDay ? new Date(`${fromDay}T00:00:00`).toISOString() : undefined,
      to: toDay ? new Date(new Date(`${toDay}T00:00:00`).getTime() + 86_400_000).toISOString() : undefined,
    }),
    [filters, fromDay, toDay]
  );

  useEffect(() => {
    let alive = true;
    listActivity({ ...query, limit: PAGE, offset: 0 })
      .then((p) => { if (alive) { setPage(p); setRows(p.data); setError(""); } })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Failed to load"); });
    return () => { alive = false; };
  }, [query]);

  const more = () =>
    listActivity({ ...query, limit: PAGE, offset: rows.length })
      .then((p) => { setPage(p); setRows((r) => [...r, ...p.data]); })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));

  const days = useMemo(() => {
    const out: { key: string; label: string; items: ActivityEntry[] }[] = [];
    for (const r of rows) {
      const k = dayKey(r.createdAt);
      if (out.at(-1)?.key !== k) out.push({ key: k, label: dayLabel(r.createdAt), items: [] });
      out.at(-1)!.items.push(r);
    }
    return out;
  }, [rows]);

  const toggle = (id: string) => setOpen((s) => { const x = new Set(s); if (x.has(id)) x.delete(id); else x.add(id); return x; });
  const hasFilters = !!(filters.group || filters.adminId || filters.q || fromDay || toDay);

  return (
    <div className="pb-16">
      <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Activity log</h1>
      <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
        Every change made from the dashboard and admin scripts. {page ? `${new Intl.NumberFormat("en-IN").format(page.total)} ${hasFilters ? "matching" : "entries"}.` : ""}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilters((f) => ({ ...f, group: undefined }))}
          aria-pressed={!filters.group}
          className="text-xs px-3 py-1.5 rounded-full"
          style={{ background: !filters.group ? "rgba(129,238,78,0.12)" : "transparent", border: `1px solid ${!filters.group ? "rgba(129,238,78,0.45)" : "var(--border-hover)"}`, color: !filters.group ? "var(--text-primary)" : "var(--text-secondary)" }}
        >
          All
        </button>
        {GROUPS.map((g) => {
          const on = filters.group === g.v;
          return (
            <button
              key={g.v}
              onClick={() => setFilters((f) => ({ ...f, group: on ? undefined : g.v }))}
              aria-pressed={on}
              className="text-xs px-3 py-1.5 rounded-full inline-flex items-center gap-1.5"
              style={{ background: on ? "rgba(129,238,78,0.12)" : "transparent", border: `1px solid ${on ? "rgba(129,238,78,0.45)" : "var(--border-hover)"}`, color: on ? "var(--text-primary)" : "var(--text-secondary)" }}
            >
              <i className="inline-block w-2 h-2 rounded-full" style={{ background: g.color }} />
              {g.label}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input value={qDraft} onChange={(e) => setQDraft(e.target.value)} placeholder="Search names, emails, reasons…" aria-label="Search activity" className="rounded-lg px-3 py-2 text-sm w-64 max-w-full" style={inputStyle} />
        <select aria-label="Admin" value={filters.adminId ?? ""} onChange={(e) => setFilters((f) => ({ ...f, adminId: e.target.value || undefined }))} className="rounded-lg px-3 py-2 text-sm" style={inputStyle}>
          <option value="">Any admin</option>
          {page?.admins.map((a) => <option key={a.id} value={a.id}>{a.email}</option>)}
          <option value="system">System (scripts, jobs)</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
          From <input type="date" value={fromDay} max={toDay || undefined} onChange={(e) => setFromDay(e.target.value)} aria-label="From date" className="rounded-lg px-2 py-1.5 text-sm" style={inputStyle} />
        </label>
        <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
          To <input type="date" value={toDay} min={fromDay || undefined} onChange={(e) => setToDay(e.target.value)} aria-label="To date" className="rounded-lg px-2 py-1.5 text-sm" style={inputStyle} />
        </label>
        {hasFilters && (
          <button onClick={() => { setQDraft(""); setFromDay(""); setToDay(""); setFilters({}); }} className="text-xs underline" style={{ color: "var(--text-secondary)" }}>
            Clear
          </button>
        )}
      </div>

      {error && <p className="mt-6 text-sm" style={{ color: "#ef4444" }}>{error}</p>}
      {!page && !error && <div className="mt-6 h-48 rounded-xl animate-pulse" style={{ background: "var(--bg-secondary)" }} />}
      {page && rows.length === 0 && <p className="mt-10 text-sm text-center" style={{ color: "var(--text-muted)" }}>Nothing here.</p>}

      {days.map((day) => (
        <section key={day.key} className="mt-6">
          <h2 className="text-[11px] uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>{day.label}</h2>
          <ol className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            {day.items.map((e, i) => {
              const href = targetHref(e);
              const isOpen = open.has(e.id);
              return (
                <li key={e.id} style={{ borderTop: i ? "1px solid var(--border)" : undefined, background: "var(--bg-secondary)" }}>
                  <div className="flex items-start gap-3 px-4 py-2.5">
                    <span className="text-xs tabular-nums pt-0.5 w-12 shrink-0" style={{ color: "var(--text-muted)" }}>{time(e.createdAt)}</span>
                    <i className="inline-block w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: colorOf(e.action) }} />
                    <button onClick={() => toggle(e.id)} className="flex-1 min-w-0 text-left" aria-expanded={isOpen}>
                      <p className="text-sm" style={{ color: "var(--text-primary)" }}>{describe(e)}</p>
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{e.admin?.email ?? "system"}</p>
                    </button>
                    {href && (
                      <Link href={href} className="text-xs px-2 py-1 rounded hover:bg-white/5 shrink-0" style={{ color: "var(--text-secondary)" }}>
                        Open
                      </Link>
                    )}
                    <button onClick={() => toggle(e.id)} aria-label={isOpen ? "Hide details" : "Show details"} className="p-1 rounded hover:bg-white/5 shrink-0" style={{ color: "var(--text-muted)" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" style={{ transform: isOpen ? "rotate(180deg)" : undefined }}><polyline points="6 9 12 15 18 9" /></svg>
                    </button>
                  </div>
                  {isOpen && <div className="px-4 pb-3 pl-[5.25rem]"><Details e={e} categoryNames={page?.categoryNames ?? {}} /></div>}
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      {page?.hasMore && (
        <div className="mt-5 flex justify-center">
          <button onClick={more} className="text-sm px-4 py-2 rounded-lg hover:bg-white/5" style={{ border: "1px solid var(--border-hover)", color: "var(--text-primary)" }}>
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
