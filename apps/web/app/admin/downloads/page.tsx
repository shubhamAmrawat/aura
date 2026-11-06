"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AvatarImage from "@/app/components/AvatarImage";
import {
  getDownloadsOverview,
  getRecentDownloads,
  type DownloadRange,
  type DownloadRow,
  type DownloadSource,
  type DownloadsOverview,
} from "@/lib/adminApi";
import { inputStyle } from "../_components/ui";

const RANGES: { key: DownloadRange; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
];
const SOURCES: { key: DownloadSource; label: string }[] = [
  { key: "all", label: "App + website" },
  { key: "app", label: "App" },
  { key: "web", label: "Website" },
];
const APP = "#81EE4E";
const WEB = "#93C5FD";
const REFRESH_MS = 60_000;

const card = { background: "var(--bg-secondary)", border: "1px solid var(--border)" };
const fmt = (n: number) => new Intl.NumberFormat("en-IN").format(n);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayLabel = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${Number(key.slice(8, 10))}`;
const hourLabel = (key: string) => {
  const h = Number(key);
  return `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
};
const ago = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
};
const sourceLabel = (s: string) => (s === "mobile" ? "App" : s === "web" ? "Website" : "Unknown");
const quality = (q: string) => (!q ? "—" : /^\d+k$/i.test(q) ? q.toUpperCase() : q[0]!.toUpperCase() + q.slice(1));

function Segmented<T extends string>({ items, value, onChange, label }: { items: { key: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex gap-1 p-1 rounded-xl" style={card}>
      {items.map((i) => (
        <button
          key={i.key}
          type="button"
          role="radio"
          aria-checked={value === i.key}
          onClick={() => onChange(i.key)}
          className="h-8 px-3 rounded-lg text-[12.5px] font-semibold"
          style={value === i.key ? { background: "var(--accent)", color: "var(--bg-primary)", fontWeight: 700 } : { color: "var(--text-secondary)" }}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

function Total({ label, total, app, web, note, change }: { label: string; total: number; app: number; web: number; note?: string; change?: number | null }) {
  return (
    <div className="flex-[1_1_200px] rounded-2xl p-4 flex flex-col gap-1" style={card}>
      <span className="text-[11.5px] font-bold tracking-wider uppercase" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="text-[28px] font-extrabold tabular-nums" style={{ color: "var(--text-primary)" }}>{fmt(total)}</span>
      {change !== undefined && (
        <span className="text-xs" style={{ color: change === null ? "var(--text-muted)" : change >= 0 ? APP : "#F87171" }}>
          {change === null ? "No earlier data" : `${change >= 0 ? "+" : ""}${change}% ${note}`}
        </span>
      )}
      {change === undefined && note && <span className="text-xs" style={{ color: "var(--text-muted)" }}>{note}</span>}
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{fmt(app)} app · {fmt(web)} web</span>
    </div>
  );
}

function Chart({ data }: { data: DownloadsOverview }) {
  const isToday = data.range === "today";
  const max = Math.max(1, ...data.chart.map((c) => c.app + c.web + c.other));
  const ticks = data.chart.length <= 7 ? data.chart.map((_, i) => i) : [0, Math.round(data.chart.length / 4), Math.round(data.chart.length / 2), Math.round((data.chart.length * 3) / 4), data.chart.length - 1];
  const empty = data.chart.every((c) => c.app + c.web + c.other === 0);
  return (
    <section className="flex-[3_1_520px] min-w-0 rounded-2xl p-5 flex flex-col gap-3" style={card}>
      <div className="flex items-center gap-4">
        <h2 className="flex-1 text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>{isToday ? "Downloads per hour (India time)" : "Downloads per day"}</h2>
        <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}><span className="w-2.5 h-2.5 rounded-sm" style={{ background: APP }} />App</span>
        <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}><span className="w-2.5 h-2.5 rounded-sm" style={{ background: WEB }} />Website</span>
      </div>
      <div className="relative h-[300px] flex items-stretch gap-[3px] pt-2" style={{ borderBottom: "1px solid var(--border-hover)" }}>
        {empty && <p className="absolute inset-0 flex items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>No downloads in this period yet.</p>}
        {data.chart.map((c) => {
          const t = c.app + c.web + c.other;
          const label = `${isToday ? hourLabel(c.key) : dayLabel(c.key)}: ${t} download${t === 1 ? "" : "s"} (${c.app} app, ${c.web} web)`;
          return (
            <div key={c.key} title={label} aria-label={label} className="group flex-1 min-w-0 flex flex-col justify-end">
              <div className="w-full rounded-t-[3px] group-hover:opacity-80" style={{ height: `${((c.web + c.other) / max) * 100}%`, background: WEB }} />
              <div className="w-full group-hover:opacity-80" style={{ height: `${(c.app / max) * 100}%`, background: APP, borderRadius: c.web + c.other ? 0 : "3px 3px 0 0" }} />
            </div>
          );
        })}
      </div>
      <div className="relative h-4 text-[11px]" style={{ color: "var(--text-muted)" }}>
        {ticks.map((i) => {
          const c = data.chart[i];
          if (!c) return null;
          const left = data.chart.length > 1 ? (i / (data.chart.length - 1)) * 100 : 0;
          return (
            <span key={i} className="absolute whitespace-nowrap" style={{ left: `${left}%`, transform: i === 0 ? "none" : i === data.chart.length - 1 ? "translateX(-100%)" : "translateX(-50%)" }}>
              {isToday ? hourLabel(c.key) : dayLabel(c.key)}
            </span>
          );
        })}
      </div>
    </section>
  );
}

function Top({ data }: { data: DownloadsOverview }) {
  const max = Math.max(1, ...data.top.map((t) => t.count));
  const rangeName = RANGES.find((r) => r.key === data.range)?.label.toLowerCase();
  return (
    <section className="flex-[2_1_360px] min-w-0 rounded-2xl p-5 flex flex-col gap-1" style={card}>
      <h2 className="text-[15px] font-bold mb-2" style={{ color: "var(--text-primary)" }}>Most downloaded · {rangeName}</h2>
      {data.top.length === 0 && <p className="text-sm py-6" style={{ color: "var(--text-muted)" }}>Nothing downloaded in this period yet.</p>}
      {data.top.map((w, i) => (
        <Link key={w.id} href={`/wallpaper/${w.id}`} target="_blank" className="flex items-center gap-3 py-2 rounded-lg hover:bg-white/[0.03]" style={{ borderTop: i ? "1px solid var(--border)" : undefined }}>
          <span className="w-5 text-right text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>{i + 1}</span>
          <span className="w-[52px] h-[46px] flex items-center justify-center shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={w.thumbUrl ?? w.fileUrl} alt="" loading="lazy" className={`${w.isMobile ? "w-[34px] h-[46px]" : "w-[52px] h-[32px]"} rounded-md object-cover`} style={{ background: "var(--bg-elevated)" }} />
          </span>
          <span className="flex-1 min-w-0 flex flex-col">
            <span className="text-[13.5px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{w.title || "Untitled"}</span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{[w.category, w.isMobile ? "Phone" : "Desktop"].filter(Boolean).join(" · ")}</span>
          </span>
          <span className="hidden sm:block w-24 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-elevated)" }}>
            <span className="block h-full rounded-full" style={{ width: `${(w.count / max) * 100}%`, background: APP }} />
          </span>
          <span className="w-9 text-right text-[13px] font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{fmt(w.count)}</span>
        </Link>
      ))}
    </section>
  );
}

function Recent({ source }: { source: DownloadSource }) {
  const [rows, setRows] = useState<DownloadRow[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [qDraft, setQDraft] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQ(qDraft.trim()), 300);
    return () => clearTimeout(t);
  }, [qDraft]);

  const load = useCallback(async () => {
    try {
      const r = await getRecentDownloads({ source, signedIn, q: q || undefined });
      setRows(r.data);
      setHasMore(r.hasMore);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [source, signedIn, q]);

  useEffect(() => {
    setRows(null);
    void load();
    const t = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const more = async () => {
    setLoadingMore(true);
    try {
      const r = await getRecentDownloads({ source, signedIn, q: q || undefined, offset: rows?.length ?? 0 });
      setRows((prev) => [...(prev ?? []), ...r.data]);
      setHasMore(r.hasMore);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoadingMore(false);
    }
  };

  const cols = "grid grid-cols-[2.2fr_1.6fr_.8fr_.8fr_.9fr] gap-3 items-center px-4";
  return (
    <section className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3.5" style={{ background: "var(--bg-secondary)" }}>
        <h2 className="flex-1 text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>Recent downloads</h2>
        <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          <input type="checkbox" checked={signedIn} onChange={(e) => setSignedIn(e.target.checked)} className="w-4 h-4 accent-[var(--accent)]" />
          Signed-in only
        </label>
        <input value={qDraft} onChange={(e) => setQDraft(e.target.value)} placeholder="Search wallpaper or user" aria-label="Search downloads" className="h-9 w-56 max-w-full rounded-lg px-3 text-sm" style={inputStyle} />
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className={`${cols} py-2 text-[11px] font-bold tracking-wider uppercase`} style={{ color: "var(--text-muted)", background: "var(--bg-primary)" }}>
            <span>Wallpaper</span><span>Downloaded by</span><span>Where</span><span>Quality</span><span>When</span>
          </div>
          {error && <p className="px-4 py-6 text-sm" style={{ color: "#ef4444" }}>{error}</p>}
          {!rows && !error && Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-4 py-3" style={{ borderTop: "1px solid var(--border)" }}><div className="h-9 rounded animate-pulse" style={{ background: "var(--bg-secondary)" }} /></div>
          ))}
          {rows?.length === 0 && <p className="px-4 py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>No downloads match.</p>}
          {rows?.map((d) => (
            <div key={d.id} className={`${cols} py-2.5`} style={{ borderTop: "1px solid var(--border)" }}>
              <Link href={`/wallpaper/${d.wallpaperId}`} target="_blank" className="flex items-center gap-3 min-w-0 hover:opacity-90">
                <span className="w-12 h-10 flex items-center justify-center shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={d.thumbUrl ?? d.fileUrl} alt="" loading="lazy" className={`${d.isMobile ? "w-[30px] h-[40px]" : "w-[48px] h-[30px]"} rounded-md object-cover`} style={{ background: "var(--bg-elevated)" }} />
                </span>
                <span className="min-w-0 flex flex-col">
                  <span className="text-[13.5px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{d.title || "Untitled"}</span>
                  <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{d.category ?? "—"}</span>
                </span>
              </Link>
              {d.userId ? (
                <Link href={`/admin/users?q=${encodeURIComponent(d.username ?? "")}`} className="flex items-center gap-2 min-w-0 hover:opacity-90">
                  <AvatarImage
                    src={d.avatarUrl}
                    alt=""
                    className="w-6 h-6 rounded-full object-cover shrink-0"
                    fallback={<span className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold" style={{ background: "var(--bg-elevated)", color: "var(--text-primary)" }}>{(d.displayName ?? "?")[0]?.toUpperCase()}</span>}
                  />
                  <span className="min-w-0 flex flex-col">
                    <span className="text-[13px] truncate" style={{ color: "var(--accent)" }}>{d.displayName}</span>
                    <span className="text-[11.5px] truncate" style={{ color: "var(--text-muted)" }}>@{d.username}</span>
                  </span>
                </Link>
              ) : (
                <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>Signed out</span>
              )}
              <span>
                <span
                  className="px-2 py-0.5 rounded-full text-[11.5px] font-bold"
                  style={d.source === "mobile" ? { background: "rgba(129,238,78,.12)", color: APP } : d.source === "web" ? { background: "rgba(147,197,253,.14)", color: WEB } : { background: "var(--bg-elevated)", color: "var(--text-muted)" }}
                >
                  {sourceLabel(d.source)}
                </span>
              </span>
              <span className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>{quality(d.quality)}</span>
              <span className="text-[12.5px]" style={{ color: "var(--text-secondary)" }} title={new Date(d.at).toLocaleString()}>{ago(d.at)}</span>
            </div>
          ))}
        </div>
      </div>
      {hasMore && (
        <button type="button" onClick={() => void more()} disabled={loadingMore} className="w-full py-3 text-[13px] font-semibold hover:bg-white/[0.03] disabled:opacity-50" style={{ borderTop: "1px solid var(--border)", color: "var(--text-primary)" }}>
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
    </section>
  );
}

/** Admin › Downloads: what's being downloaded, where (app or website), and by whom. */
export default function AdminDownloadsPage() {
  const [range, setRange] = useState<DownloadRange>("30d");
  const [source, setSource] = useState<DownloadSource>("all");
  const [data, setData] = useState<DownloadsOverview | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await getDownloadsOverview(range, source));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [range, source]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const t = data?.totals;
  const since = t?.all.since ? new Date(t.all.since).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : null;

  return (
    <div className="pb-16 flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[240px]">
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Downloads</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>What&apos;s being downloaded, where, and by whom. Updates every minute.</p>
        </div>
        <Segmented label="Period" items={RANGES} value={range} onChange={setRange} />
        <Segmented label="Where" items={SOURCES} value={source} onChange={setSource} />
      </div>

      {error && <p className="text-sm px-4 py-3 rounded-lg" style={{ color: "#ef4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>{error}</p>}

      <div className="flex flex-wrap gap-3">
        {t ? (
          <>
            <Total label="Today" {...t.today} change={t.today.change} note="vs yesterday" />
            <Total label="Last 7 days" {...t.week} change={t.week.change} note="vs previous 7" />
            <Total label="Last 30 days" {...t.month} change={t.month.change} note="vs previous 30" />
            <Total label="All time" {...t.all} note={since ? `since ${since}` : undefined} />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="flex-[1_1_200px] h-[124px] rounded-2xl animate-pulse" style={card} />)
        )}
      </div>

      {data ? (
        <div className="flex flex-wrap gap-4">
          <Chart data={data} />
          <Top data={data} />
        </div>
      ) : (
        <div className="h-[380px] rounded-2xl animate-pulse" style={card} />
      )}

      <Recent source={source} />
    </div>
  );
}
