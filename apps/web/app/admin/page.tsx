"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getAdminDashboard, type AdminDashboard, type Kpi, type SourceSplit } from "@/lib/adminApi";
import { C, CategoryChart, GrowthChart, Sparkline, TrendChart } from "./_components/charts";

type Range = 7 | 30 | 90;
type Metric = "downloads" | "views" | "likes";

const fmt = (n: number) => new Intl.NumberFormat("en-IN").format(n);
const R2_FREE_BYTES = 10 * 1024 ** 3; // Cloudflare R2 free tier: 10 GB

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
}

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ─── Building blocks ────────────────────────────────────────

function Panel({ title, action, children, className = "" }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl p-4 md:p-5 flex flex-col ${className}`} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-lg p-0.5 gap-0.5" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className="px-2.5 py-1 rounded-md text-xs transition-colors"
          style={{
            background: value === o.value ? "var(--bg-elevated)" : "transparent",
            color: value === o.value ? "var(--text-primary)" : "var(--text-muted)",
            fontWeight: value === o.value ? 600 : 400,
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Delta({ kpi }: { kpi: Kpi }) {
  const { last7d: cur, prev7d: prev } = kpi;
  if (cur === 0 && prev === 0) return <span style={{ color: "var(--text-muted)" }}>no activity yet</span>;
  if (prev === 0) return <span style={{ color: "var(--text-secondary)" }}>new this week</span>;
  const pct = Math.round(((cur - prev) / prev) * 100);
  const up = pct >= 0;
  return (
    <span className="inline-flex items-center gap-1" style={{ color: up ? "#57a83a" : "#e66767" }}>
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
        <path d={up ? "M5 1 L9 7 H1 Z" : "M5 9 L9 3 H1 Z"} fill="currentColor" />
      </svg>
      {Math.abs(pct)}% <span style={{ color: "var(--text-muted)" }}>vs prev 7d</span>
    </span>
  );
}

function KpiTile({ label, value, sub, kpi, href, highlight }: { label: string; value: number; sub?: React.ReactNode; kpi?: Kpi; href?: string; highlight?: boolean }) {
  const body = (
    <div
      className="rounded-xl p-4 h-full flex flex-col gap-1 transition-colors"
      style={{
        background: highlight ? "rgba(129,238,78,0.08)" : "var(--bg-secondary)",
        border: `1px solid ${highlight ? "rgba(129,238,78,0.35)" : "var(--border)"}`,
      }}
    >
      <p className="text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-2xl font-semibold tabular-nums" style={{ color: highlight ? "var(--accent)" : "var(--text-primary)" }}>{fmt(value)}</p>
      <p className="text-[11px] min-h-[16px]">{kpi ? <Delta kpi={kpi} /> : <span style={{ color: "var(--text-secondary)" }}>{sub}</span>}</p>
      {kpi && <div className="mt-1"><Sparkline values={kpi.spark} /></div>}
    </div>
  );
  return href ? <Link href={href} className="block hover:opacity-90">{body}</Link> : body;
}

function SplitBar({ label, split }: { label: string; split: SourceSplit }) {
  const total = split.web + split.mobile + split.unknown;
  const pct = (v: number) => (total ? (v / total) * 100 : 0);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span style={{ color: "var(--text-secondary)" }}>{label}</span>
        <span className="tabular-nums" style={{ color: "var(--text-muted)" }}>{fmt(total)}</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden gap-[2px]" style={{ background: "var(--bg-primary)" }}>
        {total > 0 && (
          <>
            {split.web > 0 && <div style={{ width: `${pct(split.web)}%`, background: C.blue }} title={`Web ${fmt(split.web)}`} />}
            {split.mobile > 0 && <div style={{ width: `${pct(split.mobile)}%`, background: C.orange }} title={`Mobile ${fmt(split.mobile)}`} />}
            {split.unknown > 0 && <div style={{ width: `${pct(split.unknown)}%`, background: "#3a3a3a" }} title={`Unknown ${fmt(split.unknown)}`} />}
          </>
        )}
      </div>
      <div className="flex gap-3 mt-1.5 text-[11px]" style={{ color: "var(--text-secondary)" }}>
        <span className="inline-flex items-center gap-1"><i className="inline-block w-2 h-2 rounded-sm" style={{ background: C.blue }} />Web {fmt(split.web)}</span>
        <span className="inline-flex items-center gap-1"><i className="inline-block w-2 h-2 rounded-sm" style={{ background: C.orange }} />Mobile {fmt(split.mobile)}</span>
        {split.unknown > 0 && <span style={{ color: "var(--text-muted)" }}>Older app {fmt(split.unknown)}</span>}
      </div>
    </div>
  );
}

const ACTION_LABELS: Record<string, string> = {
  "wallpaper.approve": "approved",
  "wallpaper.reject": "rejected",
  "wallpaper.restore": "restored",
  "wallpaper.purge": "auto-deleted",
  "admin.create": "created an admin account",
  "stats.reset": "reset the stats",
  "user.role.make_admin": "granted admin role",
};

function activityText(e: AdminDashboard["recent"][number]) {
  if (e.kind === "signup") return <><b>@{e.who}</b> signed up</>;
  if (e.kind === "upload") return <><b>@{e.who}</b> uploaded “{e.what}”{e.ref && e.ref !== "approved" ? ` · ${e.ref}` : ""}</>;
  const label = ACTION_LABELS[e.what ?? ""] ?? e.what;
  return <><b>{e.who === "system" ? "System" : `@${e.who}`}</b> {label}{e.ref ? <> “{e.ref}”</> : null}</>;
}

const KIND_DOT: Record<string, string> = { signup: C.blue, upload: C.orange, admin: "#888888" };

function Empty({ text }: { text: string }) {
  return <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>{text}</p>;
}

// ─── Page ───────────────────────────────────────────────────

export default function AdminOverviewPage() {
  const [range, setRange] = useState<Range>(30);
  const [metric, setMetric] = useState<Metric>("downloads");
  const [catMetric, setCatMetric] = useState<"wallpapers" | "downloads">("wallpapers");
  const [topBy, setTopBy] = useState<Metric>("downloads");
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (days: Range) => {
    setLoading(true);
    setError("");
    try {
      setData(await getAdminDashboard(days));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(range); }, [range, load]);

  const categoryData = useMemo(() => {
    if (!data) return [];
    const sorted = [...data.categories].sort((a, b) => b[catMetric] - a[catMetric]);
    const head = sorted.slice(0, 9).map((c) => ({ name: c.name, value: c[catMetric] }));
    const rest = sorted.slice(9).reduce((s, c) => s + c[catMetric], 0);
    return rest > 0 ? [...head, { name: "Other", value: rest }] : head;
  }, [data, catMetric]);

  const metricLabel = { downloads: "Downloads", views: "Views", likes: "Likes" } as const;

  return (
    <div>
      {/* Header + range filter (scopes everything below) */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Overview</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {data ? `Updated ${new Date(data.generatedAt).toLocaleTimeString()} · days in India time` : "How Aurora is doing"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Segmented<Range> value={range} onChange={setRange} options={[{ value: 7, label: "7 days" }, { value: 30, label: "30 days" }, { value: 90, label: "90 days" }]} />
          <button
            onClick={() => void load(range)}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-white/5 disabled:opacity-40"
            style={{ border: "1px solid var(--border-hover)", color: "var(--text-secondary)" }}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-6 text-sm px-4 py-3 rounded-lg" style={{ color: "#ef4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
          {error}
        </p>
      )}

      {!data && loading && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mt-6">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-32 rounded-xl animate-pulse" style={{ background: "var(--bg-secondary)" }} />)}
          <div className="col-span-2 lg:col-span-4 h-80 rounded-xl animate-pulse" style={{ background: "var(--bg-secondary)" }} />
          <div className="col-span-2 h-80 rounded-xl animate-pulse" style={{ background: "var(--bg-secondary)" }} />
        </div>
      )}

      {data && (
        <div className="transition-opacity" style={{ opacity: loading ? 0.6 : 1 }}>
          {/* Row 1: KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mt-6">
            <KpiTile label="Live wallpapers" value={data.totals.liveWallpapers} sub={`+${fmt(data.kpis.uploads.last7d)} uploaded this week`} />
            <KpiTile label="Users" value={data.totals.users} sub={`+${fmt(data.kpis.signups.last7d)} this week · ${fmt(data.totals.creators)} ${data.totals.creators === 1 ? "creator" : "creators"}`} />
            <KpiTile label="Downloads · 7d" value={data.kpis.downloads.last7d} kpi={data.kpis.downloads} />
            <KpiTile label="Views · 7d" value={data.kpis.views.last7d} kpi={data.kpis.views} />
            <KpiTile label="Likes · 7d" value={data.kpis.likes.last7d} kpi={data.kpis.likes} />
            <KpiTile
              label="Pending review"
              value={data.totals.pending}
              sub={data.totals.pending > 0 ? "Review now →" : "All caught up"}
              href="/admin/review"
              highlight={data.totals.pending > 0}
            />
          </div>

          {/* Row 2: activity + needs attention */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 mt-3">
            <Panel
              title={`${metricLabel[metric]} per day`}
              className="xl:col-span-2"
              action={<Segmented<Metric> value={metric} onChange={setMetric} options={[{ value: "downloads", label: "Downloads" }, { value: "views", label: "Views" }, { value: "likes", label: "Likes" }]} />}
            >
              <p className="text-xs -mt-2 mb-3" style={{ color: "var(--text-muted)" }}>
                {fmt(data.series.reduce((s, d) => s + d[metric], 0))} in the last {range} days
              </p>
              <div className="h-64"><TrendChart data={data.series} dataKey={metric} name={metricLabel[metric]} /></div>
            </Panel>

            <Panel title="Needs attention">
              <div className="flex flex-col gap-4">
                <Link href="/admin/review" className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-white/5" style={{ border: "1px solid var(--border)" }}>
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Waiting for review</span>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: data.attention.pending ? "var(--accent)" : "var(--text-primary)" }}>
                    {fmt(data.attention.pending)}
                    {data.attention.oldestPendingAt && <span className="font-normal text-xs ml-1.5" style={{ color: "var(--text-muted)" }}>oldest {timeAgo(data.attention.oldestPendingAt)}</span>}
                  </span>
                </Link>
                <Link href="/admin/review" className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-white/5" style={{ border: "1px solid var(--border)" }}>
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Rejected, deleted within 7 days</span>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                    {fmt(data.attention.rejectedExpiringSoon)}
                    <span className="font-normal text-xs ml-1.5" style={{ color: "var(--text-muted)" }}>of {fmt(data.attention.rejected)}</span>
                  </span>
                </Link>
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span style={{ color: "var(--text-secondary)" }}>Storage (R2)</span>
                    <span className="tabular-nums" style={{ color: "var(--text-muted)" }}>{formatBytes(data.attention.storageBytes)} of 10 GB free tier</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-primary)" }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (data.attention.storageBytes / R2_FREE_BYTES) * 100)}%`, background: C.series }} />
                  </div>
                </div>
                <div className="pt-1 flex flex-col gap-3" style={{ borderTop: "1px solid var(--border)" }}>
                  <p className="text-[11px] uppercase tracking-wider pt-3" style={{ color: "var(--text-muted)" }}>Web vs mobile · {range} days</p>
                  <SplitBar label="Downloads" split={data.platform.downloads} />
                  <SplitBar label="Views" split={data.platform.views} />
                </div>
              </div>
            </Panel>
          </div>

          {/* Row 3: growth + categories */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mt-3">
            <Panel title="Sign-ups & uploads per day">
              <div className="h-64"><GrowthChart data={data.series} /></div>
            </Panel>
            <Panel
              title={catMetric === "wallpapers" ? "Live wallpapers by category" : `Downloads by category · ${range} days`}
              action={<Segmented value={catMetric} onChange={setCatMetric} options={[{ value: "wallpapers", label: "Wallpapers" }, { value: "downloads", label: "Downloads" }]} />}
            >
              {categoryData.every((c) => c.value === 0)
                ? <Empty text="No downloads in this period yet." />
                : <div style={{ height: Math.max(160, categoryData.length * 26) }}><CategoryChart data={categoryData} dataKey="value" name={catMetric === "wallpapers" ? "Wallpapers" : "Downloads"} /></div>}
            </Panel>
          </div>

          {/* Row 4: top wallpapers + recent activity */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mt-3 mb-4">
            <Panel
              title={`Top wallpapers · ${range} days`}
              action={<Segmented<Metric> value={topBy} onChange={setTopBy} options={[{ value: "downloads", label: "Downloads" }, { value: "views", label: "Views" }, { value: "likes", label: "Likes" }]} />}
            >
              {data.top[topBy].length === 0 ? (
                <Empty text={`No ${topBy} in this period yet.`} />
              ) : (
                <ol className="flex flex-col gap-2">
                  {data.top[topBy].map((w, i) => (
                    <li key={w.id} className="flex items-center gap-3">
                      <span className="w-4 text-xs tabular-nums text-right" style={{ color: "var(--text-muted)" }}>{i + 1}</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={w.fileUrl} alt="" loading="lazy" className="w-9 h-12 rounded object-cover" style={{ background: w.dominantColor }} />
                      <Link href={`/wallpaper/${w.id}`} target="_blank" className="flex-1 min-w-0 text-sm truncate hover:underline" style={{ color: "var(--text-primary)" }}>{w.title}</Link>
                      <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{fmt(w.count)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>

            <Panel title="Recent activity">
              {data.recent.length === 0 ? (
                <Empty text="Nothing yet." />
              ) : (
                <ul className="flex flex-col">
                  {data.recent.map((e, i) => (
                    <li key={i} className="flex items-start gap-3 py-2" style={{ borderTop: i ? "1px solid var(--border)" : undefined }}>
                      <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ background: KIND_DOT[e.kind] }} />
                      <p className="flex-1 min-w-0 text-sm truncate" style={{ color: "var(--text-secondary)" }}>{activityText(e)}</p>
                      <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>{timeAgo(e.at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
