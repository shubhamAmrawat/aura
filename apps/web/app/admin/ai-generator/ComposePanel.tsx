"use client";

import { useMemo, useState } from "react";
import { Toggle, inputStyle } from "../_components/ui";
import { BUDGET, Chip, DIMS, ICONS, Label, MODELS, PRESETS, PRICE, Segmented, usd, type Format, type ModelId, type Mode, type Res } from "./shared";
import { XIcon } from "lucide-react";

const FIELDS = [
  { key: "subject", label: "Subject", placeholder: "Lone lighthouse on a basalt cliff" },
  { key: "scene", label: "Scene", placeholder: "Storm clearing over a rough sea" },
  { key: "style", label: "Style", placeholder: "Cinematic photograph, long exposure" },
  { key: "lighting", label: "Lighting", placeholder: "Blue hour, beam cutting through mist" },
  { key: "mood", label: "Mood", placeholder: "Calm, solitary, hopeful" },
  { key: "camera", label: "Camera", placeholder: "35mm, low angle, deep focus" },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];

const THEME_CONCEPTS = [
  "Diyas floating on the Ganges at Varanasi, fireworks reflected",
  "Rangoli close-up from above, marigold petals and brass lamps",
  "Old Delhi rooftop at dusk, lanterns strung across the lanes",
  "Minimal: a single diya flame on deep indigo, soft bokeh",
  "Anime: kids with sparklers on a terrace, painted night sky",
  "Golden temple doorway glowing with hundreds of lamps",
];

const COPYRIGHT = /\b(naruto|goku|pikachu|pok[eé]mon|marvel|iron ?man|spider-?man|batman|superman|disney|mickey|star wars|harry potter|one piece|demon slayer|genshin)\b/i;

export default function ComposePanel({ onGenerate }: { onGenerate: (summary: string) => void }) {
  const [mode, setMode] = useState<Mode>("prompt");
  const [idea, setIdea] = useState("");
  const [theme, setTheme] = useState("Diwali");
  const [concepts, setConcepts] = useState<boolean[]>(() => THEME_CONCEPTS.map((_, i) => i < 3));
  const [change, setChange] = useState("");
  const [structOpen, setStructOpen] = useState(true);
  const [fields, setFields] = useState<Record<FieldKey, string>>({ subject: "", scene: "", style: "", lighting: "", mood: "", camera: "" });
  const [palette, setPalette] = useState<string[]>(["#0f1c2e", "#e8b04a", "#5fa3b8"]);
  const [preset, setPreset] = useState<string | null>("cinematic");
  const [format, setFormat] = useState<Format>("phone");
  const [model, setModel] = useState<ModelId>("nb2");
  const [res, setRes] = useState<Res>("1K");
  const [count, setCount] = useState(4);
  const [refs, setRefs] = useState<number>(0);
  const [rules, setRules] = useState({ clock: true, dock: true, noText: true, edge: true });
  const [advanced, setAdvanced] = useState(false);
  const [batch, setBatch] = useState(false);
  const [png, setPng] = useState<"png" | "jpeg">("png");
  const [autoQa, setAutoQa] = useState(true);

  const conceptCount = mode === "theme" ? concepts.filter(Boolean).length : 1;
  const images = count * (format === "both" ? 2 : 1) * conceptCount;
  const cost = images * PRICE[model][res] * (batch ? 0.5 : 1);
  const left = BUDGET.cap - BUDGET.spent;
  const overBudget = cost > left;

  const finalPrompt = useMemo(() => {
    const parts = [
      fields.subject || idea,
      fields.scene,
      fields.style || (preset ? PRESETS.find((p) => p.id === preset)?.hint : ""),
      fields.lighting && `lighting: ${fields.lighting}`,
      fields.mood && `mood: ${fields.mood}`,
      fields.camera && `camera: ${fields.camera}`,
      palette.length ? `palette ${palette.join(", ")}` : "",
      format !== "desktop" && rules.clock ? "calm uncluttered top third for the clock" : "",
      rules.dock ? "clean bottom edge for the dock" : "",
      rules.noText ? "no text, letters, logos or watermarks" : "",
      rules.edge ? "full-bleed, no borders or frames" : "",
    ].filter(Boolean);
    return parts.join(", ");
  }, [fields, idea, preset, palette, format, rules]);

  const copyrightHit = (idea + " " + fields.subject + " " + change).match(COPYRIGHT)?.[0];
  const canGenerate = (mode === "prompt" ? (idea.trim() || fields.subject.trim()) : mode === "theme" ? conceptCount > 0 : change.trim()) && !overBudget;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "prompt", label: "Prompt", title: "Write your own idea" },
            { value: "theme", label: "Theme drop", title: "AI proposes several concepts for a theme" },
            { value: "remix", label: "Remix", title: "Start from an existing wallpaper or result" },
          ]}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">
        {mode === "prompt" && (
          <section>
            <Label hint={`${idea.length}/600`}>Idea</Label>
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value.slice(0, 600))}
              rows={3}
              placeholder="Describe the wallpaper — e.g. a lighthouse on a cliff at blue hour, storm clearing…"
              className="w-full text-sm rounded-lg px-3 py-2 resize-y"
              style={inputStyle}
            />
            <button
              type="button"
              onClick={() => onGenerate("Enhance isn't connected yet — it will fill the fields below from your idea.")}
              className="mt-2 w-full flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-lg transition-colors hover:bg-white/5"
              style={{ color: "var(--accent)", border: "1px solid rgba(129,238,78,0.35)" }}
            >
              {ICONS.sparkle} Enhance into a detailed prompt
            </button>
          </section>
        )}

        {mode === "theme" && (
          <section>
            <Label>Theme</Label>
            <div className="flex gap-2">
              <input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="Diwali, monsoon, Holi…" className="flex-1 min-w-0 text-sm rounded-lg px-3 py-2" style={inputStyle} />
              <button type="button" onClick={() => onGenerate("Concept suggestions aren't connected yet.")} className="shrink-0 flex items-center gap-1.5 text-sm font-medium px-3 rounded-lg hover:bg-white/5" style={{ color: "var(--accent)", border: "1px solid rgba(129,238,78,0.35)" }}>
                {ICONS.sparkle} Suggest
              </button>
            </div>
            <div className="mt-3 flex flex-col gap-1.5">
              {THEME_CONCEPTS.map((c, i) => (
                <label key={c} className="flex items-start gap-2.5 text-sm px-2.5 py-2 rounded-lg cursor-pointer transition-colors" style={{ background: concepts[i] ? "rgba(129,238,78,0.06)" : "var(--bg-primary)", border: `1px solid ${concepts[i] ? "rgba(129,238,78,0.3)" : "var(--border)"}`, color: "var(--text-primary)" }}>
                  <input type="checkbox" checked={concepts[i]} onChange={() => setConcepts((p) => p.map((v, j) => (j === i ? !v : v)))} className="mt-0.5 accent-[#81ee4e]" />
                  <span className="leading-snug">{c}</span>
                </label>
              ))}
            </div>
            <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>{conceptCount} of {THEME_CONCEPTS.length} concepts selected — each is generated with the settings below.</p>
          </section>
        )}

        {mode === "remix" && (
          <section>
            <Label>Start from</Label>
            <button type="button" onClick={() => onGenerate("Picking a source isn't connected yet.")} className="w-full aspect-[16/7] rounded-lg flex flex-col items-center justify-center gap-1 text-sm transition-colors hover:bg-white/5" style={{ border: "1px dashed var(--border-hover)", color: "var(--text-secondary)" }}>
              {ICONS.ref}
              <span>Choose a wallpaper or a past result</span>
            </button>
            <div className="mt-4"><Label>What should change?</Label></div>
            <textarea value={change} onChange={(e) => setChange(e.target.value)} rows={3} placeholder="Same scene at night with fireflies; keep the composition" className="w-full text-sm rounded-lg px-3 py-2 resize-y" style={inputStyle} />
          </section>
        )}

        {copyrightHit && (
          <div className="flex gap-2 text-xs rounded-lg px-3 py-2.5" style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.3)", color: "#eab308" }}>
            <span className="mt-0.5 shrink-0">{ICONS.warn}</span>
            <span>“{copyrightHit}” is a protected character or brand. Generated copies can&apos;t be sold as premium — describe an original character or scene instead.</span>
          </div>
        )}

        {mode !== "theme" && (
          <section>
            <button type="button" onClick={() => setStructOpen((v) => !v)} className="w-full flex items-center justify-between mb-2" aria-expanded={structOpen}>
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Prompt details</span>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{structOpen ? "Hide" : "Edit"}</span>
            </button>
            {structOpen && (
              <div className="flex flex-col gap-2">
                {FIELDS.map((f) => (
                  <div key={f.key} className="grid grid-cols-[72px_1fr] items-center gap-2">
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{f.label}</span>
                    <input value={fields[f.key]} onChange={(e) => setFields((p) => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} className="text-sm rounded-md px-2.5 py-1.5 min-w-0" style={inputStyle} />
                  </div>
                ))}
                <div className="grid grid-cols-[72px_1fr] items-center gap-2">
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Palette</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {palette.map((c, i) => (
                      <span key={i} className="relative group">
                        <input type="color" value={c} onChange={(e) => setPalette((p) => p.map((v, j) => (j === i ? e.target.value : v)))} aria-label={`Colour ${i + 1}`} className="w-7 h-7 rounded-md cursor-pointer border-0 p-0 bg-transparent" />
                        <button type="button" onClick={() => setPalette((p) => p.filter((_, j) => j !== i))} aria-label="Remove colour" className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full hidden group-hover:flex items-center justify-center" style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-hover)" }}>
                          <XIcon size={8} strokeWidth={3} aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                    {palette.length < 5 && (
                      <button type="button" onClick={() => setPalette((p) => [...p, "#888888"])} aria-label="Add colour" className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/5" style={{ border: "1px dashed var(--border-hover)", color: "var(--text-secondary)" }}>{ICONS.plus}</button>
                    )}
                    <span className="text-[11px] font-mono ml-1" style={{ color: "var(--text-muted)" }}>{palette.join(" ")}</span>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        <section>
          <Label>Style</Label>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <Chip key={p.id} on={preset === p.id} onClick={() => setPreset(preset === p.id ? null : p.id)} title={p.hint}>{p.label}</Chip>
            ))}
          </div>
        </section>

        <section>
          <Label hint={format === "both" ? `${DIMS.phone[res]} + ${DIMS.desktop[res]}` : DIMS[format][res]}>Format</Label>
          <Segmented
            value={format}
            onChange={setFormat}
            options={[
              { value: "phone", label: <span className="flex items-center justify-center gap-1.5"><span className="inline-block w-2 h-3.5 rounded-[2px] border border-current" />Phone</span> },
              { value: "desktop", label: <span className="flex items-center justify-center gap-1.5"><span className="inline-block w-4 h-2.5 rounded-[2px] border border-current" />Desktop</span> },
              { value: "both", label: "Both", title: "Generated separately for each — never cropped" },
            ]}
          />
        </section>

        <section>
          <Label>Model</Label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(MODELS) as ModelId[]).map((id) => {
              const m = MODELS[id];
              const on = model === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => { setModel(id); if (id === "nbpro") setRes("4K"); else setRes("1K"); }}
                  className="text-left rounded-lg px-3 py-2.5 transition-colors"
                  style={{ background: on ? "rgba(129,238,78,0.06)" : "var(--bg-primary)", border: `1px solid ${on ? "rgba(129,238,78,0.45)" : "var(--border)"}` }}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: on ? "var(--accent)" : "var(--text-muted)" }}>{m.role}</span>
                  <span className="block text-sm font-medium mt-0.5" style={{ color: "var(--text-primary)" }}>{m.name}</span>
                  <span className="block text-[11px] mt-0.5 leading-snug" style={{ color: "var(--text-secondary)" }}>{m.blurb}</span>
                  <span className="block text-[11px] mt-1.5 font-mono" style={{ color: "var(--text-muted)" }}>from {usd(PRICE[id]["1K"])}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-2">
            <Segmented
              size="sm"
              value={res}
              onChange={setRes}
              options={(["1K", "2K", "4K"] as Res[]).map((r) => ({ value: r, label: <span>{r} <span style={{ color: "var(--text-muted)" }}>· {usd(PRICE[model][r])}</span></span> }))}
            />
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div>
            <Label>Variations</Label>
            <Segmented size="sm" value={String(count)} onChange={(v) => setCount(Number(v))} options={["1", "2", "3", "4"].map((v) => ({ value: v, label: v }))} />
          </div>
          <div>
            <Label hint={`${refs}/4`}>References</Label>
            <div className="flex gap-1">
              {[0, 1, 2, 3].map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRefs((r) => (i < r ? r - 1 : Math.min(4, r + 1)))}
                  aria-label={i < refs ? "Remove reference" : "Add reference image"}
                  className="flex-1 aspect-square rounded-md flex items-center justify-center transition-colors hover:bg-white/5"
                  style={i < refs ? { background: `linear-gradient(135deg, ${palette[i % palette.length] ?? "#333"}, #111)`, border: "1px solid var(--border-hover)" } : { border: "1px dashed var(--border-hover)", color: "var(--text-muted)" }}
                >
                  {i >= refs && ICONS.plus}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section>
          <Label>Wallpaper rules</Label>
          <div className="rounded-lg px-3 py-1" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
            <Toggle checked={rules.clock} onChange={(v) => setRules((r) => ({ ...r, clock: v }))} label="Keep the clock area calm (phone)" disabled={format === "desktop"} />
            <Toggle checked={rules.dock} onChange={(v) => setRules((r) => ({ ...r, dock: v }))} label="Keep the dock / taskbar area clean" />
            <Toggle checked={rules.noText} onChange={(v) => setRules((r) => ({ ...r, noText: v }))} label="No text, logos or watermarks" />
            <Toggle checked={rules.edge} onChange={(v) => setRules((r) => ({ ...r, edge: v }))} label="Full-bleed (no borders or frames)" />
          </div>
        </section>

        <section>
          <button type="button" onClick={() => setAdvanced((v) => !v)} className="w-full flex items-center justify-between" aria-expanded={advanced}>
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Advanced</span>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{advanced ? "Hide" : "Show"}</span>
          </button>
          {advanced && (
            <div className="mt-2 flex flex-col gap-3">
              <div className="rounded-lg px-3 py-1" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
                <Toggle checked={batch} onChange={setBatch} label="Batch mode — 50% cheaper, results in minutes to hours" />
                <Toggle checked={autoQa} onChange={setAutoQa} label="Automatic quality check" />
              </div>
              <div>
                <Label>Output file</Label>
                <Segmented size="sm" value={png} onChange={setPng} options={[{ value: "png", label: "PNG (lossless)" }, { value: "jpeg", label: "JPEG" }]} />
              </div>
              <div>
                <Label>Final prompt (sent to the model)</Label>
                <p className="text-xs leading-relaxed rounded-lg px-3 py-2 font-mono break-words" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  {finalPrompt || "—"}
                </p>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="px-4 py-3 flex flex-col gap-2" style={{ borderTop: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
        <div className="flex items-baseline justify-between text-xs">
          <span style={{ color: "var(--text-secondary)" }}>
            {images} image{images === 1 ? "" : "s"} · <span className="font-mono" style={{ color: overBudget ? "#ef4444" : "var(--text-primary)" }}>~{usd(cost)}</span>
            {batch && <span style={{ color: "var(--accent)" }}> · batch</span>}
          </span>
          <span style={{ color: "var(--text-muted)" }}>{usd(left)} left this month</span>
        </div>
        <button
          type="button"
          disabled={!canGenerate}
          onClick={() => onGenerate(`Generation isn't connected yet — this would create ${images} image${images === 1 ? "" : "s"} for ~${usd(cost)}.`)}
          className="w-full flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-lg transition-opacity disabled:opacity-40"
          style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
        >
          {ICONS.sparkle} {overBudget ? "Over this month's budget" : `Generate ${images}`}
        </button>
      </div>
    </div>
  );
}
