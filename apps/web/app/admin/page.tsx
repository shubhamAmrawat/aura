"use client";

import { useCallback, useEffect, useState } from "react";
import { getAdminOverview, type AdminOverview } from "@/lib/adminApi";

const fmt = (n: number) => new Intl.NumberFormat("en-IN").format(n);

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
}

function Card({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
      <p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-2xl font-semibold mt-2 tabular-nums" style={{ color: accent ? "var(--accent)" : "var(--text-primary)" }}>
        {value}
      </p>
      {sub && <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{sub}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>{title}</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{children}</div>
    </section>
  );
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getAdminOverview());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Overview</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {data ? `Updated ${new Date(data.generatedAt).toLocaleTimeString()}` : "How Aurora is doing"}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="text-xs px-3 py-2 rounded-lg transition-colors hover:bg-white/5 disabled:opacity-40"
          style={{ border: "1px solid var(--border-hover)", color: "var(--text-secondary)" }}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && (
        <p className="mt-6 text-sm px-4 py-3 rounded-lg" style={{ color: "#ef4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
          {error}
        </p>
      )}

      {!data && loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: "var(--bg-secondary)" }} />
          ))}
        </div>
      )}

      {data && (
        <>
          {data.wallpapers.pending > 0 && (
            <div
              className="mt-6 flex items-center justify-between gap-3 px-4 py-3 rounded-xl"
              style={{ background: "rgba(129,238,78,0.08)", border: "1px solid rgba(129,238,78,0.3)" }}
            >
              <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                <span className="font-semibold">{fmt(data.wallpapers.pending)}</span>{" "}
                {data.wallpapers.pending === 1 ? "wallpaper is" : "wallpapers are"} waiting for review
              </p>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>Review queue coming in Phase 2</span>
            </div>
          )}

          <Section title="Wallpapers">
            <Card label="Live" value={fmt(data.wallpapers.approved)} sub={`${fmt(data.wallpapers.total)} total`} />
            <Card label="Pending review" value={fmt(data.wallpapers.pending)} accent={data.wallpapers.pending > 0} sub={`${fmt(data.wallpapers.rejected)} rejected`} />
            <Card label="New uploads" value={fmt(data.wallpapers.new7d)} sub={`last 7 days · ${fmt(data.wallpapers.new30d)} in 30`} />
            <Card label="Storage" value={formatBytes(data.wallpapers.storageBytes)} sub={`${fmt(data.wallpapers.featured)} featured`} />
          </Section>

          <Section title="Users">
            <Card label="Total users" value={fmt(data.users.total)} />
            <Card label="New sign-ups" value={fmt(data.users.new7d)} sub={`last 7 days · ${fmt(data.users.new30d)} in 30`} />
            <Card label="Creators" value={fmt(data.users.creators)} />
            <Card label="Admins" value={fmt(data.users.admins)} />
          </Section>

          <Section title="Engagement">
            <Card label="Downloads" value={fmt(data.downloads.total)} sub={`${fmt(data.downloads.last7d)} last 7 days · ${fmt(data.downloads.last30d)} in 30`} />
            <Card label="Views" value={fmt(data.views.total)} sub="all time" />
            <Card label="Likes" value={fmt(data.likes.total)} sub={`${fmt(data.likes.last7d)} last 7 days · ${fmt(data.likes.last30d)} in 30`} />
            <Card label="Downloads logged" value={fmt(data.downloads.logged)} sub="since per-download tracking began" />
          </Section>
        </>
      )}
    </div>
  );
}
