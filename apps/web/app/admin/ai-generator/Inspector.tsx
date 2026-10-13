"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { Toggle, inputStyle } from "../_components/ui";
import { ICONS, Label, MODELS, qaColor, Segmented, usd, type GenImage, type Job } from "./shared";

type View = "frame" | "full" | "watermark";

const QA_ROWS: { key: keyof GenImage["qa"]; label: string }[] = [
  { key: "composition", label: "Fits the format" },
  { key: "sharpness", label: "Sharpness / artifacts" },
  { key: "anatomy", label: "Faces & hands" },
  { key: "noText", label: "No stray text" },
  { key: "aesthetic", label: "Aesthetic" },
];

export default function Inspector({ img, job, onClose, onAction }: { img: GenImage | null; job: Job | null; onClose?: () => void; onAction: (msg: string) => void }) {
  const [view, setView] = useState<View>("frame");
  const [title, setTitle] = useState("");
  const [premium, setPremium] = useState(true);
  const [watermark, setWatermark] = useState(true);

  if (!img || !job) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6 py-16 gap-2">
        <span style={{ color: "var(--text-muted)" }}>{ICONS.ref}</span>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Select a result to inspect it</p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Preview it on a phone or desktop, check its quality scores, then publish.</p>
      </div>
    );
  }

  const phone = img.format === "phone";
  const copy = () => { navigator.clipboard?.writeText(job.prompt).catch(() => {}); onAction("Prompt copied."); };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 pt-4 pb-3 gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
        <Segmented size="sm" value={view} onChange={setView} options={[{ value: "frame", label: phone ? "Phone" : "Desktop" }, { value: "full", label: "Full" }, { value: "watermark", label: "Watermark" }]} />
        {onClose && <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-md hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>{ICONS.close}</button>}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">
        {/* preview */}
        <div className="flex justify-center">
          {view === "frame" && phone && (
            <div className="relative w-[190px] aspect-[9/19.5] rounded-[28px] p-[6px]" style={{ background: "#000", boxShadow: "0 0 0 1px rgba(255,255,255,0.12), 0 12px 32px rgba(0,0,0,0.6)" }}>
              <div className="relative w-full h-full rounded-[22px] overflow-hidden" style={{ background: img.color }}>
                <img src={img.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute top-[3%] left-1/2 -translate-x-1/2 w-[34%] h-[3.2%] rounded-full bg-black" />
                <div className="absolute inset-x-0 top-[10%] text-center text-white" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.4)" }}>
                  <p className="text-[9px] opacity-90">Tuesday 13 October</p>
                  <p className="text-[38px] font-semibold leading-none tracking-tight">9:41</p>
                </div>
                <div className="absolute inset-x-[6%] bottom-[3%] h-[9%] rounded-[16px] flex items-center justify-around px-2" style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(8px)" }}>
                  {[0, 1, 2, 3].map((i) => <span key={i} className="w-[18%] aspect-square rounded-[9px]" style={{ background: "rgba(255,255,255,0.35)" }} />)}
                </div>
              </div>
            </div>
          )}
          {view === "frame" && !phone && (
            <div className="w-full">
              <div className="relative w-full aspect-video rounded-t-lg overflow-hidden p-[5px]" style={{ background: "#000", boxShadow: "0 0 0 1px rgba(255,255,255,0.12)" }}>
                <div className="relative w-full h-full rounded overflow-hidden" style={{ background: img.color }}>
                  <img src={img.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute left-[3%] top-[6%] flex flex-col gap-[6%] w-[7%] h-[60%]">
                    {[0, 1, 2].map((i) => <span key={i} className="w-full aspect-square rounded" style={{ background: "rgba(255,255,255,0.3)" }} />)}
                  </div>
                  <div className="absolute inset-x-[30%] bottom-[3%] h-[8%] rounded-md" style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(6px)" }} />
                </div>
              </div>
              <div className="mx-auto w-[22%] h-3" style={{ background: "linear-gradient(#1a1a1a, #0c0c0c)" }} />
              <div className="mx-auto w-[40%] h-1.5 rounded-b" style={{ background: "#1f1f1f" }} />
            </div>
          )}
          {view !== "frame" && (
            <div className={`relative rounded-lg overflow-hidden ${phone ? "w-[200px] aspect-[9/16]" : "w-full aspect-video"}`} style={{ background: img.color, border: "1px solid var(--border)" }}>
              <img src={img.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
              {view === "watermark" && (
                <span className="absolute right-[4%] bottom-[3%] text-[11px] font-semibold tracking-wide text-white" style={{ opacity: 0.55, textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>aurora ✦</span>
              )}
            </div>
          )}
        </div>

        {/* quality */}
        <section>
          <Label hint={<span className="font-mono" style={{ color: qaColor(img.qa.overall) }}>{img.qa.overall}/100</span>}>Quality check</Label>
          <div className="flex flex-col gap-2">
            {QA_ROWS.map((r) => (
              <div key={r.key} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{r.label}</span>
                <span className="text-[11px] font-mono" style={{ color: qaColor(img.qa[r.key]) }}>{img.qa[r.key]}</span>
                <div className="col-span-2 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="h-full rounded-full" style={{ width: `${img.qa[r.key]}%`, background: qaColor(img.qa[r.key]) }} />
                </div>
              </div>
            ))}
          </div>
          {img.flags.length > 0 && (
            <div className="mt-3 flex gap-2 text-xs rounded-lg px-3 py-2" style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.3)", color: "#eab308" }}>
              <span className="mt-0.5 shrink-0">{ICONS.warn}</span>
              <span>{img.flags.join(" · ")}</span>
            </div>
          )}
        </section>

        {/* actions */}
        <section className="grid grid-cols-2 gap-2">
          {[
            { label: "Finalize in 4K", icon: ICONS.upscale, msg: "Finalize in 4K isn't connected yet." },
            { label: "More like this", icon: ICONS.shuffle, msg: "Variations aren't connected yet." },
            { label: "Remix", icon: ICONS.edit, msg: "Remix isn't connected yet." },
            { label: "Use as reference", icon: ICONS.ref, msg: "Added as a reference (layout preview)." },
          ].map((a) => (
            <button key={a.label} type="button" onClick={() => onAction(a.msg)} className="flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg hover:bg-white/5" style={{ color: "var(--text-primary)", border: "1px solid var(--border-hover)" }}>
              {a.icon} {a.label}
            </button>
          ))}
        </section>

        {/* prompt + details */}
        <section>
          <Label hint={<button type="button" onClick={copy} className="flex items-center gap-1 hover:underline" style={{ color: "var(--text-secondary)" }}>{ICONS.copy} Copy</button>}>Prompt</Label>
          <p className="text-xs leading-relaxed rounded-lg px-3 py-2" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>{job.prompt}</p>
          <dl className="mt-3 grid grid-cols-[88px_1fr] gap-y-1.5 text-xs">
            {[
              ["Model", MODELS[job.model].name],
              ["Size", `${job.res} · ${phone ? "9:16" : "16:9"}`],
              ["Cost", usd(job.cost / Math.max(1, job.images.length))],
              ["Created", job.createdAt],
              ["Provenance", "SynthID + IPTC “AI generated”"],
            ].map(([k, v]) => (
              <div key={k} className="contents">
                <dt style={{ color: "var(--text-muted)" }}>{k}</dt>
                <dd style={{ color: "var(--text-primary)" }}>{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* publish */}
        <section className="rounded-xl p-3 flex flex-col gap-2.5" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
          <Label>Publish</Label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title — AI suggests one on publish" className="text-sm rounded-lg px-3 py-2" style={inputStyle} />
          <div className="grid grid-cols-2 gap-2">
            <select className="text-sm rounded-lg px-2 py-2" style={inputStyle} defaultValue="" aria-label="Category">
              <option value="">✨ Auto category</option>
              <option>Nature</option>
              <option>Space</option>
              <option>City</option>
              <option>Abstract</option>
            </select>
            <input placeholder="Tags (auto)" className="text-sm rounded-lg px-3 py-2 min-w-0" style={inputStyle} />
          </div>
          <div className="px-1">
            <Toggle checked={premium} onChange={setPremium} label="Premium (clean file needs an unlock)" />
            <Toggle checked={watermark} onChange={setWatermark} label="Watermark on the public copy" disabled={!premium} />
            <Toggle checked onChange={() => onAction("The AI label is required by India's IT Rules 2026 and can't be turned off.")} label="“AI generated” label" />
          </div>
          <button type="button" onClick={() => onAction("Publishing isn't connected yet.")} className="w-full text-sm font-semibold py-2.5 rounded-lg" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>
            Publish wallpaper
          </button>
        </section>
      </div>
    </div>
  );
}
