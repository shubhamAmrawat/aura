"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import CreatorStatusCard from "@/app/components/CreatorStatusCard";
import { useToast } from "@/lib/toast";
import {
  getCreatorStatus,
  imageSize,
  removeSample,
  submitApplication,
  uploadSample,
  type CreatorSample,
  type CreatorStatus,
} from "@/lib/creatorApi";

const TYPES = ["image/jpeg", "image/png", "image/webp"];
/** Uploads running at the same time. */
const PARALLEL = 2;

type Slot = {
  key: string;
  preview: string;
  state: "queued" | "uploading" | "checking" | "ready" | "error";
  progress: number;
  error?: string;
  file?: File;
  sample?: CreatorSample;
  abort?: AbortController;
};

const CRITERIA = [
  { t: "Your own work", s: "Made or shot by you — no reposts, and no upscales of other people’s art." },
  { t: "Sharp and high resolution", s: "Clean detail and no heavy compression, at least 1080 px on the short side." },
  { t: "Made for screens", s: "Composition that still works behind app icons and a clock." },
  { t: "Small signatures are fine", s: "A subtle watermark is OK as long as it doesn’t cover the image. No brand or character content." },
  { t: "A consistent eye", s: "Together, your samples should show a style of your own." },
];

let nextKey = 0;
const newKey = () => `s${++nextKey}`;

export default function ApplyForm() {
  const { toast } = useToast();
  const [status, setStatus] = useState<CreatorStatus | null>(null);
  const [loadError, setLoadError] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [portfolio, setPortfolio] = useState("");
  const [about, setAbout] = useState("");
  const [original, setOriginal] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const slotsRef = useRef<Slot[]>([]);
  slotsRef.current = slots;

  const load = useCallback(() => {
    setLoadError("");
    getCreatorStatus()
      .then((s) => {
        setStatus(s);
        // Pick up images uploaded earlier but not sent yet.
        setSlots((cur) =>
          cur.length ? cur : s.drafts.map((d) => ({ key: newKey(), preview: d.thumbUrl, state: "ready" as const, progress: 1, sample: d }))
        );
      })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : "Couldn’t load your application."));
  }, []);

  useEffect(load, [load]);

  // Free local previews when leaving.
  useEffect(() => () => slotsRef.current.forEach((s) => s.preview.startsWith("blob:") && URL.revokeObjectURL(s.preview)), []);

  const rules = status?.rules;
  const max = rules?.maxSamples ?? 6;
  const min = rules?.minSamples ?? 3;

  const patch = (key: string, p: Partial<Slot>) => setSlots((cur) => cur.map((s) => (s.key === key ? { ...s, ...p } : s)));

  /** Upload queued slots, at most PARALLEL at a time. */
  const pump = useCallback(() => {
    const cur = slotsRef.current;
    const running = cur.filter((s) => s.state === "uploading" || s.state === "checking").length;
    const next = cur.filter((s) => s.state === "queued").slice(0, Math.max(0, PARALLEL - running));
    for (const slot of next) {
      const abort = new AbortController();
      patch(slot.key, { state: "uploading", progress: 0, abort, error: undefined });
      slotsRef.current = slotsRef.current.map((s) => (s.key === slot.key ? { ...s, state: "uploading" } : s));
      uploadSample(slot.file!, (p) => patch(slot.key, p >= 1 ? { progress: 1, state: "checking" } : { progress: p }), abort.signal)
        .then((sample) => patch(slot.key, { state: "ready", sample, progress: 1, abort: undefined }))
        .catch((e: unknown) => {
          if (e instanceof DOMException && e.name === "AbortError") return;
          patch(slot.key, { state: "error", error: e instanceof Error ? e.message : "Upload failed.", abort: undefined });
        })
        .finally(() => setTimeout(pump, 0));
    }
  }, []);

  async function addFiles(list: FileList | File[]) {
    const files = Array.from(list);
    if (!files.length || !rules) return;
    const notes: string[] = [];
    const room = max - slotsRef.current.length;
    if (room <= 0) {
      toast(`You can add up to ${max} wallpapers.`, "error");
      return;
    }
    if (files.length > room) notes.push(`Only ${room} more ${room === 1 ? "image fits" : "images fit"} — the rest were left out.`);

    const added: Slot[] = [];
    for (const file of files.slice(0, room)) {
      if (!TYPES.includes(file.type)) { notes.push(`${file.name}: use a JPG, PNG or WebP image.`); continue; }
      if (file.size > rules.maxBytes) { notes.push(`${file.name}: larger than 25 MB.`); continue; }
      try {
        const { width, height } = await imageSize(file);
        if (Math.min(width, height) < rules.minShortSide) {
          notes.push(`${file.name} is ${width} × ${height} — needs at least ${rules.minShortSide} px on the short side.`);
          continue;
        }
      } catch {
        notes.push(`${file.name}: not an image we can read.`);
        continue;
      }
      added.push({ key: newKey(), preview: URL.createObjectURL(file), state: "queued", progress: 0, file });
    }
    setSkipped(notes);
    if (!added.length) return;
    slotsRef.current = [...slotsRef.current, ...added];
    setSlots((cur) => [...cur, ...added]);
    pump();
  }

  async function remove(slot: Slot) {
    slot.abort?.abort();
    setSlots((cur) => cur.filter((s) => s.key !== slot.key));
    slotsRef.current = slotsRef.current.filter((s) => s.key !== slot.key);
    if (slot.preview.startsWith("blob:")) URL.revokeObjectURL(slot.preview);
    if (slot.sample) {
      try {
        await removeSample(slot.sample.id);
      } catch {
        // Not critical: unsent images are cleaned up when the application is sent.
      }
    }
    setTimeout(pump, 0);
  }

  const retry = (slot: Slot) => {
    patch(slot.key, { state: "queued", error: undefined, progress: 0 });
    slotsRef.current = slotsRef.current.map((s) => (s.key === slot.key ? { ...s, state: "queued" } : s));
    pump();
  };

  const ready = slots.filter((s) => s.state === "ready");
  const busy = slots.some((s) => s.state === "queued" || s.state === "uploading" || s.state === "checking");
  const failed = slots.some((s) => s.state === "error");
  const blocker =
    ready.length < min
      ? `Add ${min - ready.length} more ${min - ready.length === 1 ? "wallpaper" : "wallpapers"}`
      : busy
        ? "Waiting for uploads to finish…"
        : failed
          ? "Remove or retry the image that failed"
          : !original
            ? "Confirm these are your own work"
            : "";

  async function submit() {
    if (blocker || submitting) return;
    setSubmitting(true);
    try {
      const s = await submitApplication({ sampleIds: ready.map((r) => r.sample!.id), about, portfolioUrl: portfolio });
      setStatus(s);
      setSlots([]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn’t send your application.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── states other than the form ───
  let body: React.ReactNode;
  if (loadError) {
    body = (
      <div className="rounded-3xl p-8 flex flex-col items-start gap-4" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
        <p className="text-[15px]">{loadError}</p>
        <button type="button" onClick={load} className="h-10 px-5 rounded-full text-sm font-medium border border-white/[0.14] hover:bg-white/[0.05]">Try again</button>
      </div>
    );
  } else if (!status) {
    body = (
      <div className="flex flex-col gap-4" aria-busy="true">
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="aspect-[9/16] rounded-2xl animate-pulse" style={{ background: "var(--bg-elevated)" }} />)}
        </div>
        <div className="h-56 rounded-3xl animate-pulse" style={{ background: "var(--bg-elevated)" }} />
      </div>
    );
  } else if (status.isCreator) {
    body = (
      <section className="rounded-3xl p-8 sm:p-10 flex flex-col gap-4" style={{ background: "var(--bg-elevated)", border: "1px solid rgba(129,238,78,0.25)" }}>
        <span className="self-start h-[26px] px-2.5 rounded-full text-xs font-medium inline-flex items-center" style={{ background: "var(--accent-muted)", color: "var(--accent)" }}>Creator</span>
        <h2 className="text-[34px] leading-tight" style={{ fontFamily: "var(--font-serif), serif" }}>You’re already a creator</h2>
        <p className="text-[15px]" style={{ color: "var(--text-secondary)" }}>Publish your wallpapers to Aurora — each upload gets a quick review.</p>
        <Link href="/upload" className="self-start h-11 px-6 rounded-full text-sm font-semibold inline-flex items-center hover:opacity-90" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>Upload a wallpaper</Link>
      </section>
    );
  } else if (!status.canApply) {
    body = (
      <div className="flex flex-col gap-4">
        <CreatorStatusCard status={status} onPauseEnd={load} />
        <Link href="/profile?tab=uploads" className="self-start text-sm underline underline-offset-4" style={{ color: "var(--text-secondary)" }}>Back to your profile</Link>
      </div>
    );
  }

  const lastNote = status?.application?.status === "rejected" ? status.application.note : null;

  return (
    <main className="min-h-screen pt-16" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <div className="max-w-[1200px] mx-auto px-5 sm:px-12 pt-8 sm:pt-10 pb-24 flex flex-wrap gap-10 lg:gap-14 items-start">
        <aside className="flex-[1_1_300px] lg:max-w-[370px] flex flex-col gap-5 lg:sticky lg:top-24">
          <Link href="/profile?tab=uploads" className="inline-flex items-center gap-2 min-h-11 text-[13px] transition-opacity hover:opacity-70" style={{ color: "var(--text-secondary)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
            Back to profile
          </Link>
          <p className="text-xs tracking-[0.18em] uppercase" style={{ color: "var(--accent)" }}>Creator program</p>
          <h1 className="text-[42px] sm:text-[52px] leading-[1.02]" style={{ fontFamily: "var(--font-serif), serif" }}>Show us your best work</h1>
          <p className="text-[15px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Share {min} to {max} wallpapers you’ve made. Our team reviews every application, usually within 2 days. Approved creators can publish to Aurora.
          </p>
          <details className="group lg:hidden rounded-[18px] px-5 py-4" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.07)" }}>
            <summary className="flex items-center justify-between cursor-pointer list-none text-[13px] font-medium min-h-6" style={{ color: "#d4d4d4" }}>
              What we look for
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="transition-transform group-open:rotate-180" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </summary>
            <div className="flex flex-col gap-3.5 mt-4"><Criteria /></div>
          </details>
          <div className="hidden lg:flex rounded-[18px] p-5 flex-col gap-3.5" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-[13px] font-medium" style={{ color: "#d4d4d4" }}>What we look for</p>
            <Criteria />
          </div>
        </aside>

        <div className="flex-[999_1_560px] min-w-0 flex flex-col gap-7">
          {body ?? (
            <>
              {lastNote && (
                <div className="rounded-2xl px-5 py-4 flex flex-col gap-1" style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)" }}>
                  <span className="text-xs" style={{ color: "#f87171" }}>From your last application</span>
                  <p className="text-sm leading-relaxed whitespace-pre-line">{lastNote}</p>
                  <span className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    {status!.triesBeforePause === 1 ? "This is your last try before a 1-day pause." : `${status!.triesBeforePause} more tries before a 1-day pause.`}
                  </span>
                </div>
              )}

              {/* ── samples ── */}
              <section
                aria-labelledby="h-samples"
                className="flex flex-col gap-3.5"
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
                onDrop={(e) => { e.preventDefault(); setDragging(false); void addFiles(e.dataTransfer.files); }}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h2 id="h-samples" className="text-lg font-semibold">Your best wallpapers</h2>
                  <span className="text-[13px] tabular-nums" style={{ color: ready.length >= min ? "var(--accent)" : "var(--text-muted)" }} aria-live="polite">
                    {ready.length < min ? `${ready.length} of ${min} minimum` : `${ready.length} of ${max}`}
                  </span>
                </div>
                {/* drop zone: add several wallpapers at once */}
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={slots.length >= max}
                  className="w-full rounded-[20px] px-6 py-8 sm:py-10 flex flex-col items-center justify-center gap-3 text-center transition-[background,border-color,transform] duration-200 enabled:hover:bg-white/[0.03] disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                  style={{
                    border: `1.5px dashed ${dragging ? "var(--accent)" : "rgba(255,255,255,0.16)"}`,
                    background: dragging ? "var(--accent-muted)" : "rgba(255,255,255,0.015)",
                    transform: dragging ? "scale(1.01)" : undefined,
                  }}
                >
                  <span
                    className="w-12 h-12 rounded-2xl flex items-center justify-center transition-colors"
                    style={{ background: dragging ? "var(--accent)" : "#1c1c1c", color: dragging ? "var(--bg-primary)" : "#e5e5e5" }}
                    aria-hidden="true"
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
                  </span>
                  {slots.length >= max ? (
                    <span className="text-sm" style={{ color: "var(--text-muted)" }}>All {max} slots are filled — remove one to add another.</span>
                  ) : (
                    <>
                      <span className="text-[15px] font-medium">
                        {dragging ? "Drop to add them" : <>Drag and drop up to {max - slots.length} {max - slots.length === 1 ? "wallpaper" : "wallpapers"}, or <span className="underline underline-offset-4" style={{ color: "var(--accent)" }}>browse</span></>}
                      </span>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        JPG, PNG or WebP · at least {rules!.minShortSide} px on the short side · up to 25 MB each · samples stay private
                      </span>
                    </>
                  )}
                </button>
                <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
                  {Array.from({ length: max }).map((_, i) => {
                    const slot = slots[i];
                    if (!slot) {
                      const first = i === slots.length;
                      return (
                        <button
                          key={`empty-${i}`}
                          type="button"
                          onClick={() => fileInput.current?.click()}
                          className="aspect-[9/16] rounded-2xl flex flex-col items-center justify-center gap-2.5 text-[13px] font-medium transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                          style={{ border: "1.5px dashed rgba(255,255,255,0.14)", color: "var(--text-muted)" }}
                          aria-label={`Add wallpaper ${i + 1}`}
                        >
                          <span className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: first ? "var(--accent)" : "#1c1c1c", color: first ? "var(--bg-primary)" : "#d4d4d4" }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                          </span>
                          {i < min ? "Required" : "Optional"}
                        </button>
                      );
                    }
                    return <SlotTile key={slot.key} slot={slot} n={i + 1} onRemove={() => void remove(slot)} onRetry={() => retry(slot)} />;
                  })}
                </div>
                <input
                  ref={fileInput}
                  type="file"
                  accept={TYPES.join(",")}
                  multiple
                  hidden
                  onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = ""; }}
                />
                {skipped.length > 0 && (
                  <ul className="rounded-xl px-4 py-3 text-[13px] flex flex-col gap-1" style={{ background: "rgba(250,204,21,0.06)", border: "1px solid rgba(250,204,21,0.2)", color: "#e8d48a" }} role="status">
                    {skipped.map((n) => <li key={n}>{n}</li>)}
                  </ul>
                )}
              </section>

              {/* ── details ── */}
              <section className="rounded-[20px] p-5 sm:p-6 flex flex-col gap-5" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex flex-col gap-2">
                  <label htmlFor="ap-link" className="text-[13px]" style={{ color: "#c9c9c9" }}>
                    Portfolio link <span style={{ color: "var(--text-muted)" }}>· optional</span>
                  </label>
                  <input
                    id="ap-link"
                    value={portfolio}
                    onChange={(e) => setPortfolio(e.target.value)}
                    placeholder="instagram.com/yourname, behance.net/…"
                    inputMode="url"
                    autoComplete="url"
                    maxLength={300}
                    className="w-full h-12 px-3.5 rounded-xl text-[15px] bg-[#151515] border border-white/[0.08] outline-none transition-[border-color,box-shadow] placeholder:text-[#6f6f6f] focus:border-[color:var(--accent)] focus:shadow-[0_0_0_4px_var(--accent-muted)]"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between gap-3">
                    <label htmlFor="ap-about" className="text-[13px]" style={{ color: "#c9c9c9" }}>
                      About your work <span style={{ color: "var(--text-muted)" }}>· optional</span>
                    </label>
                    <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>{about.length}/{rules!.aboutMaxLength}</span>
                  </div>
                  <textarea
                    id="ap-about"
                    rows={4}
                    value={about}
                    maxLength={rules!.aboutMaxLength}
                    onChange={(e) => setAbout(e.target.value)}
                    placeholder="What do you make, and how? Tools, style, what inspires you."
                    className="w-full px-3.5 py-3 rounded-xl text-[15px] bg-[#151515] border border-white/[0.08] outline-none resize-y transition-[border-color,box-shadow] placeholder:text-[#6f6f6f] focus:border-[color:var(--accent)] focus:shadow-[0_0_0_4px_var(--accent-muted)]"
                  />
                </div>
                <label className="flex gap-3 items-start text-sm leading-relaxed cursor-pointer" style={{ color: "#d4d4d4" }}>
                  <input type="checkbox" checked={original} onChange={(e) => setOriginal(e.target.checked)} className="w-[18px] h-[18px] mt-0.5 shrink-0" style={{ accentColor: "var(--accent)" }} />
                  These are my own original works, and I have the right to publish them.
                </label>
              </section>

              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={!!blocker || submitting}
                  className="h-[52px] px-7 rounded-full text-[15px] font-semibold inline-flex items-center gap-2.5 transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
                >
                  {submitting ? "Sending…" : "Submit application"}
                  {!submitting && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>}
                </button>
                <span className="text-[13px]" style={{ color: "var(--text-muted)" }} aria-live="polite">
                  {blocker || "We’ll email you when it’s reviewed."}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function Criteria() {
  return (
    <>
      {CRITERIA.map((c) => (
        <div key={c.t} className="flex gap-3 items-start">
          <span className="w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0 mt-px" style={{ background: "var(--accent-muted)", color: "var(--accent)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
          </span>
          <div>
            <p className="text-sm font-medium">{c.t}</p>
            <p className="text-[13px] mt-0.5 leading-normal" style={{ color: "var(--text-muted)" }}>{c.s}</p>
          </div>
        </div>
      ))}
    </>
  );
}

function SlotTile({ slot, n, onRemove, onRetry }: { slot: Slot; n: number; onRemove: () => void; onRetry: () => void }) {
  const busy = slot.state === "queued" || slot.state === "uploading" || slot.state === "checking";
  const pct = Math.round(slot.progress * 100);
  return (
    <div className="group relative aspect-[9/16] rounded-2xl overflow-hidden" style={{ background: "#141414" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={slot.preview}
        alt={`Wallpaper ${n}`}
        className="absolute inset-0 w-full h-full object-cover transition-[filter,opacity] duration-300"
        style={busy || slot.state === "error" ? { filter: "brightness(0.45) saturate(0.6)" } : undefined}
      />
      {busy && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" role="status" aria-label={`Uploading wallpaper ${n}`}>
          <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true" className={slot.state === "uploading" ? "" : "animate-spin"}>
            <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
            <circle
              cx="22" cy="22" r="18" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round"
              strokeDasharray={113}
              strokeDashoffset={slot.state === "uploading" ? 113 - (113 * pct) / 100 : 80}
              transform="rotate(-90 22 22)"
              style={{ transition: "stroke-dashoffset 0.2s ease" }}
            />
          </svg>
          <span className="text-[11px] font-medium text-white/80">
            {slot.state === "queued" ? "Waiting" : slot.state === "uploading" ? `${pct}%` : "Checking"}
          </span>
        </div>
      )}
      {slot.state === "error" && (
        <div className="absolute inset-0 p-3 flex flex-col items-center justify-center gap-2 text-center" role="alert">
          <span className="text-[11px] leading-snug" style={{ color: "#fca5a5" }}>{slot.error}</span>
          {slot.file && (
            <button type="button" onClick={onRetry} className="h-8 px-3 rounded-full text-xs font-medium bg-white/[0.12] hover:bg-white/[0.2]">Retry</button>
          )}
        </div>
      )}
      {slot.state === "ready" && slot.sample && (
        <span className="absolute left-2 bottom-2 h-[22px] px-2 rounded-md text-[10px] font-medium flex items-center bg-black/60 text-white/85 opacity-0 group-hover:opacity-100 transition-opacity">
          {slot.sample.width} × {slot.sample.height}
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove wallpaper ${n}`}
        className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center bg-black/65 text-white hover:bg-black/85 transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
  );
}
