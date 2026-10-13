"use client";

import { useEffect, useState } from "react";
import { listAdminWallpapers } from "@/lib/adminApi";
import { useToast } from "@/lib/toast";
import ComposePanel from "./ComposePanel";
import Results from "./Results";
import Inspector from "./Inspector";
import { HistoryTab, LibraryTab, SettingsTab } from "./OtherTabs";
import { BUDGET, Panel, mockJobs, usd, type GenImage, type Job } from "./shared";

const TABS = ["Studio", "History", "Prompt library", "Settings"] as const;
type Tab = (typeof TABS)[number];

function findImage(jobs: Job[], id: string | null) {
  for (const job of jobs) {
    const img = job.images.find((i) => i.id === id);
    if (img) return { img, job };
  }
  return null;
}

/**
 * AI wallpaper generator — LAYOUT PREVIEW.
 * All controls work locally; nothing calls a model yet. Sample results are existing
 * wallpapers so the layout can be judged with real images.
 */
export default function AiGeneratorPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("Studio");
  const [jobs, setJobs] = useState<Job[]>(() => mockJobs([], []));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    Promise.all([
      listAdminWallpapers({ mobile: "true", sort: "trending", limit: 4 }),
      listAdminWallpapers({ mobile: "false", sort: "trending", limit: 4 }),
    ])
      .then(([p, d]) => {
        if (!alive) return;
        const next = mockJobs(p.data, d.data);
        setJobs(next);
        setActiveId(next.find((j) => j.images.length)?.images[0]?.id ?? null);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const active = findImage(jobs, activeId);

  const say = (m: string) => toast(m);
  const open = (img: GenImage) => { setActiveId(img.id); setDrawer(true); };
  const toggleSelect = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const star = (id: string) => setJobs((js) => js.map((j) => ({ ...j, images: j.images.map((i) => (i.id === id ? { ...i, starred: !i.starred } : i)) })));

  const sample = jobs.flatMap((j) => j.images).find((i) => i.format === "phone");
  const pct = Math.min(100, (BUDGET.spent / BUDGET.cap) * 100);

  return (
    <div className="pb-10 [&_input::placeholder]:text-white/25 [&_textarea::placeholder]:text-white/25">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>AI generator</h1>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ color: "#eab308", background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.3)" }}>
              Layout preview
            </span>
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Generate wallpapers, check their quality, and publish them as premium. Not connected to a model yet — sample results are existing wallpapers.
          </p>
        </div>
        <div className="w-56">
          <div className="flex items-baseline justify-between text-xs">
            <span style={{ color: "var(--text-secondary)" }}>Budget this month</span>
            <span className="font-mono" style={{ color: "var(--text-primary)" }}>{usd(BUDGET.spent)} / {usd(BUDGET.cap)}</span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct > 85 ? "#ef4444" : "var(--accent)" }} />
          </div>
        </div>
      </div>

      <div className="mt-5 mb-5 flex gap-1 overflow-x-auto" style={{ borderBottom: "1px solid var(--border)" }} role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className="relative text-sm px-3.5 py-2.5 whitespace-nowrap transition-colors"
            style={{ color: tab === t ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: tab === t ? 600 : 400 }}
          >
            {t}
            {tab === t && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full" style={{ background: "var(--accent)" }} />}
          </button>
        ))}
      </div>

      {tab === "Studio" && (
        <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] 2xl:grid-cols-[340px_minmax(0,1fr)_340px] gap-5 items-start">
          <Panel className="overflow-hidden xl:sticky xl:top-4 xl:h-[calc(100vh-200px)] xl:min-h-[620px]">
            <ComposePanel onGenerate={say} />
          </Panel>

          <Results
            jobs={jobs}
            activeId={activeId}
            selected={selected}
            onOpen={open}
            onToggleSelect={toggleSelect}
            onStar={star}
            onAction={say}
            onClearSelection={() => setSelected(new Set())}
          />

          <Panel className="hidden 2xl:block overflow-hidden sticky top-4 h-[calc(100vh-200px)] min-h-[620px]">
            <Inspector key={activeId ?? "none"} img={active?.img ?? null} job={active?.job ?? null} onAction={say} />
          </Panel>
        </div>
      )}

      {tab === "History" && <HistoryTab jobs={jobs} onAction={say} />}
      {tab === "Prompt library" && <LibraryTab onAction={say} />}
      {tab === "Settings" && <SettingsTab sample={sample ? { url: sample.url, color: sample.color } : null} onAction={say} />}

      {/* Inspector as a drawer below 2xl, where there's no room for a third column. */}
      {tab === "Studio" && drawer && active && (
        <div className="2xl:hidden fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.55)" }} onClick={() => setDrawer(false)}>
          <div className="w-[min(380px,100vw)] h-full" style={{ background: "var(--bg-secondary)", borderLeft: "1px solid var(--border-hover)" }} onClick={(e) => e.stopPropagation()}>
            <Inspector key={activeId ?? "none"} img={active.img} job={active.job} onAction={say} onClose={() => setDrawer(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
