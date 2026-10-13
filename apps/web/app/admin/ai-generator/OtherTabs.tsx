"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { inputStyle } from "../_components/ui";
import { BUDGET, Chip, ICONS, Label, MODELS, Panel, PRESETS, PRICE, Segmented, usd, type Job, type ModelId, type Res } from "./shared";

/* ---------------- History ---------------- */

const SPEND = [0.4, 1.2, 0, 0.27, 0.81, 0.13, 0.61];

export function HistoryTab({ jobs, onAction }: { jobs: Job[]; onAction: (m: string) => void }) {
  const [q, setQ] = useState("");
  const [model, setModel] = useState<"all" | ModelId>("all");
  const max = Math.max(...SPEND);
  const rows = jobs.filter((j) => (model === "all" || j.model === model) && j.prompt.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5">
      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 p-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search prompts…" className="text-sm rounded-lg px-3 py-1.5 w-64 max-w-full" style={inputStyle} />
          <Chip on={model === "all"} onClick={() => setModel("all")}>All models</Chip>
          {(Object.keys(MODELS) as ModelId[]).map((m) => <Chip key={m} on={model === m} onClick={() => setModel(m)}>{MODELS[m].name}</Chip>)}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                <th className="px-4 py-2.5 font-semibold">Results</th>
                <th className="px-4 py-2.5 font-semibold">Prompt</th>
                <th className="px-4 py-2.5 font-semibold">Model</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold text-right">Cost</th>
                <th className="px-4 py-2.5 font-semibold">When</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((j) => (
                <tr key={j.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="px-4 py-2.5 w-36">
                    <div className="flex -space-x-3 overflow-hidden w-32">
                      {j.images.slice(0, 3).map((i) => (
                        <img key={i.id} src={i.url} alt="" className={`${i.format === "phone" ? "w-7 h-12" : "w-14 h-8"} rounded object-cover`} style={{ background: i.color, boxShadow: "0 0 0 2px var(--bg-secondary)" }} />
                      ))}
                      {j.images.length === 0 && <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 max-w-[420px]"><p className="line-clamp-2 leading-snug" style={{ color: "var(--text-primary)" }}>{j.prompt}</p></td>
                  <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{MODELS[j.model].name} · {j.res}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-[11px] px-2 py-0.5 rounded-full" style={j.status === "running" ? { background: "rgba(129,238,78,0.1)", color: "var(--accent)" } : { background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}>
                      {j.status === "running" ? "Generating" : `${j.images.length} images`}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs" style={{ color: "var(--text-primary)" }}>{usd(j.cost)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-xs" style={{ color: "var(--text-secondary)" }}>{j.createdAt}</td>
                  <td className="px-3 py-2.5">
                    <button type="button" onClick={() => onAction("Re-opening a past job isn't connected yet.")} className="text-xs hover:underline whitespace-nowrap" style={{ color: "var(--accent)" }}>Open in studio</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="flex flex-col gap-5">
        <Panel className="p-4">
          <Label>This month</Label>
          <p className="text-2xl font-bold font-mono" style={{ color: "var(--text-primary)" }}>{usd(BUDGET.spent)} <span className="text-sm font-normal" style={{ color: "var(--text-muted)" }}>of {usd(BUDGET.cap)}</span></p>
          <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full" style={{ width: `${(BUDGET.spent / BUDGET.cap) * 100}%`, background: "var(--accent)" }} />
          </div>
          <div className="mt-5 flex items-end gap-1.5 h-20">
            {SPEND.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t" title={usd(v)} style={{ height: `${max ? (v / max) * 64 : 0}px`, minHeight: 2, background: i === SPEND.length - 1 ? "var(--accent)" : "rgba(129,238,78,0.35)" }} />
                <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{["M", "T", "W", "T", "F", "S", "S"][i]}</span>
              </div>
            ))}
          </div>
          <p className="text-xs mt-3" style={{ color: "var(--text-secondary)" }}>Last 7 days · {usd(SPEND.reduce((a, b) => a + b, 0))}</p>
        </Panel>
        <Panel className="p-4">
          <Label>Totals</Label>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            {[["Generated", "46"], ["Published", "9"], ["Discarded", "31"], ["Cost per published", "$0.38"]].map(([k, v]) => (
              <div key={k} className="contents">
                <dt style={{ color: "var(--text-secondary)" }}>{k}</dt>
                <dd className="text-right font-mono" style={{ color: "var(--text-primary)" }}>{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
    </div>
  );
}

/* ---------------- Prompt library ---------------- */

export function LibraryTab({ onAction }: { onAction: (m: string) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Reusable styles. Each one adds its prompt fragments, palette and default model when picked in the studio.</p>
        <button type="button" onClick={() => onAction("Saving presets isn't connected yet.")} className="shrink-0 flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-lg" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>{ICONS.plus} New preset</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
        {PRESETS.map((p, i) => (
          <Panel key={p.id} className="p-4 flex flex-col gap-3">
            <div className="h-16 rounded-lg" style={{ background: `linear-gradient(120deg, hsl(${(i * 47) % 360} 45% 22%), hsl(${(i * 47 + 60) % 360} 55% 38%))` }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{p.label}</p>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-secondary)" }}>{p.hint}</p>
            </div>
            <div className="flex items-center justify-between mt-auto text-[11px]" style={{ color: "var(--text-muted)" }}>
              <span>{i % 2 ? MODELS.nbpro.name : MODELS.nb2.name} · used {[12, 7, 4, 9, 3, 6, 11, 2][i]}×</span>
              <button type="button" onClick={() => onAction("Editing presets isn't connected yet.")} className="hover:underline" style={{ color: "var(--accent)" }}>Edit</button>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Settings ---------------- */

export function SettingsTab({ sample, onAction }: { sample: { url: string; color: string } | null; onAction: (m: string) => void }) {
  const [cap, setCap] = useState(String(BUDGET.cap));
  const [model, setModel] = useState<ModelId>("nb2");
  const [res, setRes] = useState<Res>("1K");
  const [wmSize, setWmSize] = useState(3);
  const [wmOpacity, setWmOpacity] = useState(55);
  const [wmText, setWmText] = useState("aurora ✦");
  const [single, setSingle] = useState("19");
  const [pro, setPro] = useState("99");

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
      <Panel className="p-5 flex flex-col gap-5">
        <div>
          <p className="font-semibold" style={{ color: "var(--text-primary)" }}>Generation</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Defaults for the studio and the hard spending limit.</p>
        </div>
        <div>
          <Label hint="Generation stops when reached">Monthly budget (USD)</Label>
          <input value={cap} onChange={(e) => setCap(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" className="text-sm rounded-lg px-3 py-2 w-40 font-mono" style={inputStyle} />
        </div>
        <div>
          <Label>Default model</Label>
          <Segmented value={model} onChange={setModel} options={(Object.keys(MODELS) as ModelId[]).map((m) => ({ value: m, label: `${MODELS[m].role} · ${MODELS[m].name}` }))} />
        </div>
        <div>
          <Label>Default resolution</Label>
          <Segmented size="sm" value={res} onChange={setRes} options={(["1K", "2K", "4K"] as Res[]).map((r) => ({ value: r, label: `${r} · ${usd(PRICE[model][r])}` }))} />
        </div>
        <div className="pt-1">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Prices are Gemini API standard rates (Oct 2026). Batch mode is 50% off.</p>
        </div>
      </Panel>

      <Panel className="p-5 flex flex-col gap-5">
        <div>
          <p className="font-semibold" style={{ color: "var(--text-primary)" }}>Premium & watermark</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Applied to the public copy of premium wallpapers. The clean file stays private.</p>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_180px] gap-5 items-start">
          <div className="flex flex-col gap-4">
            <div>
              <Label>Watermark text</Label>
              <input value={wmText} onChange={(e) => setWmText(e.target.value.slice(0, 24))} className="text-sm rounded-lg px-3 py-2 w-full" style={inputStyle} />
            </div>
            <div>
              <Label hint={`text height ${wmSize}% of width`}>Size</Label>
              <input type="range" min={2} max={6} step={0.5} value={wmSize} onChange={(e) => setWmSize(Number(e.target.value))} className="w-full accent-[#81ee4e]" />
            </div>
            <div>
              <Label hint={`${wmOpacity}%`}>Opacity</Label>
              <input type="range" min={30} max={80} value={wmOpacity} onChange={(e) => setWmOpacity(Number(e.target.value))} className="w-full accent-[#81ee4e]" />
            </div>
          </div>
          <div className="relative aspect-[9/16] rounded-lg overflow-hidden" style={{ background: sample?.color ?? "#222", border: "1px solid var(--border)" }}>
            {sample && <img src={sample.url} alt="" className="absolute inset-0 w-full h-full object-cover" />}
            <span className="absolute right-[5%] bottom-[4%] font-semibold text-white whitespace-nowrap" style={{ fontSize: `${(wmSize / 100) * 180}px`, opacity: wmOpacity / 100, textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>{wmText}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Single unlock (₹)</Label>
            <input value={single} onChange={(e) => setSingle(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="text-sm rounded-lg px-3 py-2 w-full font-mono" style={inputStyle} />
          </div>
          <div>
            <Label>Aurora Pro / month (₹)</Label>
            <input value={pro} onChange={(e) => setPro(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="text-sm rounded-lg px-3 py-2 w-full font-mono" style={inputStyle} />
          </div>
        </div>
      </Panel>

      <div className="xl:col-span-2 flex justify-end">
        <button type="button" onClick={() => onAction("Saving settings isn't connected yet.")} className="text-sm font-semibold px-4 py-2 rounded-lg" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>Save settings</button>
      </div>
    </div>
  );
}
