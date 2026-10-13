"use client";
/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from "react";
import { inputStyle } from "../_components/ui";
import { Chip, ICONS, MODELS, qaColor, Segmented, usd, type GenImage, type Job } from "./shared";

type Filter = "all" | "starred" | "flagged";
type Size = "s" | "m" | "l";

const COLS: Record<Size, { phone: string; desktop: string }> = {
  s: { phone: "grid-cols-3 sm:grid-cols-4 md:grid-cols-6", desktop: "grid-cols-2 md:grid-cols-3" },
  m: { phone: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4", desktop: "grid-cols-1 sm:grid-cols-2" },
  l: { phone: "grid-cols-2 md:grid-cols-3", desktop: "grid-cols-1" },
};

const MODE_LABEL = { prompt: "Prompt", theme: "Theme drop", remix: "Remix" } as const;

export default function Results({ jobs, activeId, selected, onOpen, onToggleSelect, onStar, onAction, onClearSelection }: {
  jobs: Job[];
  activeId: string | null;
  selected: Set<string>;
  onOpen: (img: GenImage) => void;
  onToggleSelect: (id: string) => void;
  onStar: (id: string) => void;
  onAction: (msg: string) => void;
  onClearSelection: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<"best" | "order">("best");
  const [size, setSize] = useState<Size>("m");

  const counts = useMemo(() => {
    const all = jobs.flatMap((j) => j.images);
    return { all: all.length, starred: all.filter((i) => i.starred).length, flagged: all.filter((i) => i.flags.length).length };
  }, [jobs]);

  const visible = (imgs: GenImage[]) => {
    const f = imgs.filter((i) => (filter === "starred" ? i.starred : filter === "flagged" ? i.flags.length > 0 : true));
    return sort === "best" ? [...f].sort((a, b) => b.qa.overall - a.qa.overall) : f;
  };

  return (
    <div className="flex flex-col gap-4 min-w-0">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Chip on={filter === "all"} onClick={() => setFilter("all")}>All {counts.all}</Chip>
        <Chip on={filter === "starred"} onClick={() => setFilter("starred")}>★ Starred {counts.starred}</Chip>
        <Chip on={filter === "flagged"} onClick={() => setFilter("flagged")}>Flagged {counts.flagged}</Chip>
        <div className="ml-auto flex items-center gap-2">
          <select value={sort} onChange={(e) => setSort(e.target.value as "best" | "order")} className="text-xs rounded-lg px-2 py-1.5" style={inputStyle} aria-label="Sort results">
            <option value="best">Best quality first</option>
            <option value="order">Generation order</option>
          </select>
          <div className="w-[96px]">
            <Segmented size="sm" value={size} onChange={setSize} options={[{ value: "s", label: "S" }, { value: "m", label: "M" }, { value: "l", label: "L" }]} />
          </div>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="sticky top-2 z-10 flex items-center gap-3 rounded-xl px-4 py-2.5" style={{ background: "var(--bg-elevated)", border: "1px solid rgba(129,238,78,0.35)", boxShadow: "0 8px 24px rgba(0,0,0,0.45)" }}>
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{selected.size} selected</span>
          <button type="button" onClick={onClearSelection} className="text-xs hover:underline" style={{ color: "var(--text-secondary)" }}>Clear</button>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => onAction("Finalize in 4K isn't connected yet.")} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-white/5" style={{ color: "var(--text-primary)", border: "1px solid var(--border-hover)" }}>{ICONS.upscale} Finalize in 4K</button>
            <button type="button" onClick={() => onAction("Discard isn't connected yet.")} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-white/5" style={{ color: "#ef4444", border: "1px solid rgba(239,68,68,0.35)" }}>{ICONS.trash} Discard</button>
            <button type="button" onClick={() => onAction("Publishing isn't connected yet.")} className="text-xs font-semibold px-3.5 py-1.5 rounded-lg" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>Publish {selected.size}</button>
          </div>
        </div>
      )}

      {jobs.map((job) => {
        const imgs = visible(job.images);
        if (job.status === "done" && imgs.length === 0) return null;
        const fmt = job.format === "desktop" ? "desktop" : "phone";
        return (
          <section key={job.id} className="rounded-xl p-4" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
            <header className="flex items-start gap-3 mb-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug line-clamp-2" style={{ color: "var(--text-primary)" }}>{job.prompt}</p>
                <p className="text-[11px] mt-1 flex flex-wrap gap-x-2 gap-y-0.5" style={{ color: "var(--text-muted)" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{MODE_LABEL[job.mode]}</span>
                  <span>·</span><span>{MODELS[job.model].name}</span>
                  <span>·</span><span>{job.res}</span>
                  <span>·</span><span className="capitalize">{job.format}</span>
                  <span>·</span><span className="font-mono">{usd(job.cost)}</span>
                  <span>·</span><span>{job.createdAt}</span>
                </p>
              </div>
              {job.status === "running" ? (
                <span className="shrink-0 flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full" style={{ background: "rgba(129,238,78,0.1)", color: "var(--accent)" }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--accent)" }} /> Generating…
                </span>
              ) : (
                <div className="shrink-0 flex gap-1">
                  <button type="button" onClick={() => onAction("Re-run isn't connected yet.")} title="Run again with the same settings" className="p-1.5 rounded-md hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>{ICONS.rerun}</button>
                  <button type="button" onClick={() => onAction("Editing a past prompt isn't connected yet.")} title="Edit prompt and run again" className="p-1.5 rounded-md hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>{ICONS.edit}</button>
                </div>
              )}
            </header>

            <div className={`grid gap-2.5 ${COLS[size][fmt]}`}>
              {job.status === "running" &&
                Array.from({ length: job.pending ?? 4 }).map((_, i) => (
                  <div key={i} className={`relative rounded-lg overflow-hidden ${fmt === "phone" ? "aspect-[9/16]" : "aspect-video"}`} style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
                    <div className="absolute inset-0 animate-pulse" style={{ background: "linear-gradient(160deg, rgba(129,238,78,0.05), transparent 60%)" }} />
                    <span className="absolute bottom-2 left-2 text-[10px]" style={{ color: "var(--text-muted)" }}>{i === 0 ? "Generating…" : "Queued"}</span>
                  </div>
                ))}
              {imgs.map((img) => (
                <ResultCard
                  key={img.id}
                  img={img}
                  active={img.id === activeId}
                  selected={selected.has(img.id)}
                  onOpen={() => onOpen(img)}
                  onToggleSelect={() => onToggleSelect(img.id)}
                  onStar={() => onStar(img.id)}
                  onAction={onAction}
                />
              ))}
            </div>
          </section>
        );
      })}

      {counts.all === 0 && (
        <div className="rounded-xl py-16 text-center text-sm" style={{ border: "1px dashed var(--border-hover)", color: "var(--text-secondary)" }}>
          Results appear here. Describe an idea on the left and press Generate.
        </div>
      )}
    </div>
  );
}

function ResultCard({ img, active, selected, onOpen, onToggleSelect, onStar, onAction }: {
  img: GenImage;
  active: boolean;
  selected: boolean;
  onOpen: () => void;
  onToggleSelect: () => void;
  onStar: () => void;
  onAction: (msg: string) => void;
}) {
  const flagged = img.flags.length > 0;
  return (
    <div
      className={`group relative rounded-lg overflow-hidden cursor-pointer ${img.format === "phone" ? "aspect-[9/16]" : "aspect-video"}`}
      style={{ background: img.color, outline: active ? "2px solid var(--accent)" : selected ? "2px solid rgba(129,238,78,0.5)" : "1px solid var(--border)", outlineOffset: active || selected ? 2 : 0 }}
      onClick={onOpen}
    >
      <img src={img.url} alt="" loading="lazy" className={`absolute inset-0 w-full h-full object-cover transition-opacity ${flagged ? "opacity-60 group-hover:opacity-100" : ""}`} />

      <div className="absolute inset-x-0 top-0 p-1.5 flex items-start justify-between" style={{ background: "linear-gradient(rgba(0,0,0,0.55), transparent)" }}>
        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          aria-label="Select"
          onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
          className={`w-5 h-5 rounded-md flex items-center justify-center transition-opacity ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
          style={selected ? { background: "var(--accent)", color: "var(--bg-primary)" } : { background: "rgba(0,0,0,0.5)", border: "1.5px solid rgba(255,255,255,0.7)" }}
        >
          {selected && ICONS.check}
        </button>
        <span className="text-[10px] font-semibold font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(0,0,0,0.6)", color: qaColor(img.qa.overall) }} title="Quality score">
          {img.qa.overall}
        </span>
      </div>

      {flagged && (
        <div className="absolute left-1.5 bottom-1.5 right-1.5 flex flex-wrap gap-1 group-hover:opacity-0 transition-opacity">
          {img.flags.map((f) => (
            <span key={f} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(0,0,0,0.7)", color: "#eab308" }}>{f}</span>
          ))}
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 p-1.5 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.7))" }}>
        {[
          { label: img.starred ? "Unstar" : "Star", icon: ICONS.star, run: onStar, on: img.starred },
          { label: "More like this", icon: ICONS.shuffle, run: () => onAction("Variations aren't connected yet.") },
          { label: "Finalize in 4K", icon: ICONS.upscale, run: () => onAction("Finalize in 4K isn't connected yet.") },
          { label: "Use as reference", icon: ICONS.ref, run: () => onAction("Added as a reference (layout preview).") },
        ].map((a) => (
          <button
            key={a.label}
            type="button"
            title={a.label}
            aria-label={a.label}
            onClick={(e) => { e.stopPropagation(); a.run(); }}
            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/20"
            style={{ background: "rgba(0,0,0,0.55)", color: a.on ? "#eab308" : "#fff" }}
          >
            {a.icon}
          </button>
        ))}
      </div>

      {img.starred && <span className="absolute top-1.5 left-8 text-[#eab308] group-hover:opacity-0" aria-label="Starred">★</span>}
    </div>
  );
}
