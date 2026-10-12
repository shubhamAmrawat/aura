"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  UPLOAD_MAX_BYTES,
  UPLOAD_MAX_FILES,
  UPLOAD_MIN_EDGE,
  UPLOAD_TYPES,
  createAdminUpload,
  getCategoryOptions,
  putFileToStorage,
  requestUploadSlots,
  resolutionOf,
  type CategoryOption,
  type UploadSlot,
} from "@/lib/adminApi";
import { useToast } from "@/lib/toast";
import { StatusBadge, Toggle, inputStyle } from "../_components/ui";

type Status = "ready" | "uploading" | "processing" | "done" | "failed";
type Item = {
  id: string;
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  title: string;
  categoryId: string;
  tagsText: string;
  status: Status;
  progress: number;
  error?: string;
  result?: { id: string; status: string; warnings: string[]; category: { name: string; auto: boolean } };
};
type Defaults = { categoryId: string; tagsText: string; isPremium: boolean; isAiGenerated: boolean; publish: boolean };

const CONCURRENCY = 3;
/** categoryId value that lets the API pick the category from the image */
const AUTO = "auto";
const RETRIES = 2;
const MB = 1024 * 1024;

const parseTags = (text: string) => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(",")) {
    const t = raw.trim().slice(0, 40);
    if (t && !seen.has(t.toLowerCase())) { seen.add(t.toLowerCase()); out.push(t); }
  }
  return out.slice(0, 30);
};

/** "sunset_over-hills.jpg" → "Sunset Over Hills" */
const titleFromName = (name: string) =>
  name
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ")
    .slice(0, 120) || "Untitled";

const readSize = (url: string) =>
  new Promise<{ width: number; height: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = url;
  });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Worth trying again: network errors, rate limits, server errors (and an expired upload link). */
const retryable = (status: number) => status === 0 || status === 403 || status === 408 || status === 429 || status >= 500;

export default function BulkUploadPage() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [defaults, setDefaults] = useState<Defaults>({ categoryId: AUTO, tagsText: "", isPremium: false, isAiGenerated: false, publish: true });
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getCategoryOptions().then(setCategories).catch(() => toast("Couldn't load categories", "error"));
  }, [toast]);

  // Free the preview blobs when leaving the page
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.previewUrl)), []);

  // Warn before closing the tab mid-upload
  useEffect(() => {
    if (!running) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [running]);

  const patch = useCallback((id: string, p: Partial<Item>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i)));
  }, []);

  const counts = useMemo(() => {
    const c = { ready: 0, uploading: 0, processing: 0, done: 0, failed: 0, warnings: 0, pending: 0 };
    for (const i of items) {
      c[i.status]++;
      if (i.result?.warnings.length) c.warnings++;
      if (i.result?.status === "pending") c.pending++;
    }
    return c;
  }, [items]);
  const open = items.filter((i) => i.status !== "done").length;

  // ── Adding files ───────────────────────────────────────────
  const addFiles = async (list: FileList | File[]) => {
    const files = Array.from(list);
    const skipped: string[] = [];
    const existing = new Set(itemsRef.current.map((i) => `${i.file.name}:${i.file.size}`));
    let room = UPLOAD_MAX_FILES - itemsRef.current.filter((i) => i.status !== "done").length;
    const added: Item[] = [];
    for (const file of files) {
      if (!(UPLOAD_TYPES as readonly string[]).includes(file.type)) { skipped.push(`${file.name}: not JPEG, PNG or WebP`); continue; }
      if (file.size > UPLOAD_MAX_BYTES) { skipped.push(`${file.name}: larger than 25 MB`); continue; }
      if (existing.has(`${file.name}:${file.size}`)) { skipped.push(`${file.name}: already in the list`); continue; }
      if (room <= 0) { skipped.push(`${file.name}: batch is full (${UPLOAD_MAX_FILES} max)`); continue; }
      const previewUrl = URL.createObjectURL(file);
      const { width, height } = await readSize(previewUrl);
      if (!width) { URL.revokeObjectURL(previewUrl); skipped.push(`${file.name}: couldn't read the image`); continue; }
      if (width < UPLOAD_MIN_EDGE || height < UPLOAD_MIN_EDGE) { URL.revokeObjectURL(previewUrl); skipped.push(`${file.name}: smaller than ${UPLOAD_MIN_EDGE}×${UPLOAD_MIN_EDGE}`); continue; }
      existing.add(`${file.name}:${file.size}`);
      room--;
      const d = defaultsRef.current;
      added.push({
        id: crypto.randomUUID(), file, previewUrl, width, height,
        title: titleFromName(file.name), categoryId: d.categoryId, tagsText: d.tagsText,
        status: "ready", progress: 0,
      });
    }
    if (added.length) setItems((prev) => [...prev, ...added]);
    if (skipped.length) {
      toast(skipped.length === 1 ? `Skipped ${skipped[0]}` : `Skipped ${skipped.length} files — ${skipped.slice(0, 3).join("; ")}${skipped.length > 3 ? "…" : ""}`, "error");
    }
  };

  const remove = (id: string) => {
    setItems((prev) => {
      const it = prev.find((i) => i.id === id);
      if (it) URL.revokeObjectURL(it.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  const applyDefaults = () => {
    setItems((prev) => prev.map((i) => (i.status === "ready" || i.status === "failed" ? { ...i, categoryId: defaults.categoryId || i.categoryId, tagsText: defaults.tagsText } : i)));
    toast("Applied to every file that isn't uploaded yet.", "success");
  };

  const clearFinished = () => {
    setItems((prev) => {
      prev.filter((i) => i.status === "done").forEach((i) => URL.revokeObjectURL(i.previewUrl));
      return prev.filter((i) => i.status !== "done");
    });
  };

  // ── Uploading ──────────────────────────────────────────────
  /** Upload one file: PUT to storage (fresh link on retry), then create the wallpaper. */
  const uploadOne = async (id: string, firstSlot: UploadSlot | undefined): Promise<boolean> => {
    const item = itemsRef.current.find((i) => i.id === id);
    if (!item) return false;
    const d = defaultsRef.current;
    let slot = firstSlot;

    for (let attempt = 0; ; attempt++) {
      if (!slot) {
        const s = await requestUploadSlots([{ fileType: item.file.type, fileSizeBytes: item.file.size }]);
        if (!s.ok) {
          if (attempt < RETRIES && retryable(s.status)) { await sleep(1500 * (attempt + 1)); continue; }
          { patch(id, { status: "failed", error: s.error }); return false; }
        }
        slot = s.data.items[0];
      }
      patch(id, { status: "uploading", progress: 0, error: undefined });
      const putStatus = await putFileToStorage(slot!.uploadUrl, item.file, (f) => patch(id, { progress: f }));
      if (putStatus >= 200 && putStatus < 300) break;
      slot = undefined; // expired or broken link → ask for a new one
      if (attempt < RETRIES && retryable(putStatus)) { await sleep(1500 * (attempt + 1)); continue; }
      patch(id, { status: "failed", error: putStatus ? `Storage refused the file (${putStatus})` : "Upload interrupted — check your connection" });
      return false;
    }

    patch(id, { status: "processing", progress: 1 });
    const latest = itemsRef.current.find((i) => i.id === id) ?? item;
    const payload = {
      key: slot!.key, fileUrl: slot!.fileUrl, fileType: item.file.type, fileSizeBytes: item.file.size,
      width: item.width, height: item.height,
      title: latest.title.trim(), tags: parseTags(latest.tagsText), categoryId: latest.categoryId,
      isPremium: d.isPremium, isAiGenerated: d.isAiGenerated, publish: d.publish,
    };
    for (let attempt = 0; ; attempt++) {
      const r = await createAdminUpload(payload);
      if (r.ok) {
        patch(id, { status: "done", result: { id: r.data.wallpaper.id, status: r.data.wallpaper.status, warnings: r.data.warnings, category: r.data.category } });
        return true;
      }
      if (attempt < RETRIES && retryable(r.status) && r.status !== 403) { await sleep(2000 * (attempt + 1)); continue; }
      patch(id, { status: "failed", error: r.error });
      return false;
    }
  };

  const start = async (onlyFailed = false) => {
    const queue = itemsRef.current.filter((i) => (onlyFailed ? i.status === "failed" : i.status === "ready" || i.status === "failed"));
    if (!queue.length) return;
    const invalid = queue.filter((i) => !i.title.trim() || !i.categoryId);
    if (invalid.length) {
      setShowErrors(true);
      toast(`${invalid.length} file${invalid.length === 1 ? " needs" : "s need"} a title and a category.`, "error");
      return;
    }
    setShowErrors(false);
    setRunning(true);
    try {
      // One request presigns the whole batch; a file whose link fails gets a fresh one on retry.
      const slots = await requestUploadSlots(queue.map((i) => ({ fileType: i.file.type, fileSizeBytes: i.file.size })));
      const slotFor = new Map<string, UploadSlot>();
      if (slots.ok) queue.forEach((i, n) => slotFor.set(i.id, slots.data.items[n]!));
      else if (!retryable(slots.status)) { toast(slots.error, "error"); return; }

      queue.forEach((i) => patch(i.id, { status: "ready", progress: 0, error: undefined }));
      let next = 0;
      let ok = 0;
      const worker = async () => {
        while (next < queue.length) {
          const it = queue[next++]!;
          if (await uploadOne(it.id, slotFor.get(it.id))) ok++;
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
      const bad = queue.length - ok;
      toast(bad ? `${ok} uploaded, ${bad} failed — retry the failed ones.` : `${ok} wallpaper${ok === 1 ? "" : "s"} uploaded${defaultsRef.current.publish ? " and live" : " — waiting in the review queue"}.`, bad ? "error" : "success");
    } finally {
      setRunning(false);
    }
  };

  const editable = (i: Item) => !running && (i.status === "ready" || i.status === "failed");

  return (
    <div className="pb-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Bulk upload</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Up to {UPLOAD_MAX_FILES} images per batch · JPEG, PNG or WebP · 25 MB each. Colours, size and search data are filled in automatically.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
        {/* Side panel */}
        <aside className="lg:order-2 lg:sticky lg:top-6 flex flex-col gap-4">
          <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Batch defaults</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>New files start with these. Each file can still be changed.</p>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>Category</span>
              <select aria-label="Default category" value={defaults.categoryId} disabled={running} onChange={(e) => setDefaults((d) => ({ ...d, categoryId: e.target.value }))} className="rounded-lg px-3 py-2 text-sm" style={inputStyle}>
                <option value="">Choose a category</option>
                <option value={AUTO}>✨ Auto — AI picks from the image</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>Tags (comma separated)</span>
              <input aria-label="Default tags" value={defaults.tagsText} disabled={running} onChange={(e) => setDefaults((d) => ({ ...d, tagsText: e.target.value }))} placeholder="e.g. anime, dark, 4k" className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
            </label>
            <div className="flex flex-col">
              <Toggle label="Premium" checked={defaults.isPremium} disabled={running} onChange={(v) => setDefaults((d) => ({ ...d, isPremium: v }))} />
              <Toggle label="AI generated" checked={defaults.isAiGenerated} disabled={running} onChange={(v) => setDefaults((d) => ({ ...d, isAiGenerated: v }))} />
              <Toggle label="Publish immediately" checked={defaults.publish} disabled={running} onChange={(v) => setDefaults((d) => ({ ...d, publish: v }))} />
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {defaults.publish ? "Files go live as soon as they're processed." : "Files wait in the Review queue until you approve them."}
              </p>
            </div>
            <button
              onClick={applyDefaults}
              disabled={running || !items.some((i) => i.status === "ready" || i.status === "failed")}
              className="text-xs px-3 py-2 rounded-lg disabled:opacity-40 hover:bg-white/5"
              style={{ border: "1px solid var(--border-hover)", color: "var(--text-primary)" }}
            >
              Apply category &amp; tags to all files
            </button>
          </div>

          {items.length > 0 && (
            <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Batch</p>
              <dl className="grid grid-cols-2 gap-y-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                <dt>Ready</dt><dd className="text-right tabular-nums">{counts.ready}</dd>
                <dt>In progress</dt><dd className="text-right tabular-nums">{counts.uploading + counts.processing}</dd>
                <dt>Uploaded</dt><dd className="text-right tabular-nums" style={{ color: counts.done ? "var(--accent)" : undefined }}>{counts.done}</dd>
                <dt>Failed</dt><dd className="text-right tabular-nums" style={{ color: counts.failed ? "#ef4444" : undefined }}>{counts.failed}</dd>
                {counts.warnings > 0 && <><dt>With warnings</dt><dd className="text-right tabular-nums" style={{ color: "#f59e0b" }}>{counts.warnings}</dd></>}
              </dl>
              <button
                onClick={() => start(false)}
                disabled={running || counts.ready + counts.failed === 0}
                className="text-sm font-semibold px-4 py-2.5 rounded-lg disabled:opacity-40"
                style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
              >
                {running
                  ? `Uploading… ${counts.done}/${counts.done + counts.uploading + counts.processing + counts.ready + counts.failed}`
                  : counts.ready + counts.failed === 0
                    ? "All uploaded"
                    : `Upload ${counts.ready + counts.failed} file${counts.ready + counts.failed === 1 ? "" : "s"}`}
              </button>
              <div className="flex gap-2">
                {counts.failed > 0 && !running && (
                  <button onClick={() => start(true)} className="flex-1 text-xs px-3 py-2 rounded-lg hover:bg-white/5" style={{ border: "1px solid var(--border-hover)", color: "var(--text-primary)" }}>
                    Retry failed ({counts.failed})
                  </button>
                )}
                {counts.done > 0 && !running && (
                  <button onClick={clearFinished} className="flex-1 text-xs px-3 py-2 rounded-lg hover:bg-white/5" style={{ border: "1px solid var(--border-hover)", color: "var(--text-secondary)" }}>
                    Clear uploaded
                  </button>
                )}
              </div>
              {counts.pending > 0 && (
                <Link href="/admin/review" className="text-xs underline" style={{ color: "var(--text-secondary)" }}>
                  {counts.pending} waiting in the Review queue →
                </Link>
              )}
            </div>
          )}
        </aside>

        {/* Main column */}
        <div className="lg:order-1 min-w-0 flex flex-col gap-3">
          <div
            role="button"
            tabIndex={0}
            aria-label="Add images: drop files here or press to browse"
            onClick={() => !running && inputRef.current?.click()}
            onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !running) { e.preventDefault(); inputRef.current?.click(); } }}
            onDragOver={(e) => { e.preventDefault(); if (!running) setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!running && e.dataTransfer.files.length) void addFiles(e.dataTransfer.files); }}
            className="rounded-xl flex flex-col items-center justify-center text-center gap-2 cursor-pointer transition-colors"
            style={{
              minHeight: items.length ? 120 : 260,
              border: `1.5px dashed ${dragOver ? "var(--accent)" : "var(--border-hover)"}`,
              background: dragOver ? "rgba(129,238,78,0.06)" : "var(--bg-secondary)",
              opacity: running ? 0.5 : 1,
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: dragOver ? "var(--accent)" : "var(--text-muted)" }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Drop images here or <span style={{ color: "var(--accent)" }}>browse</span></p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{open}/{UPLOAD_MAX_FILES} in this batch</p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={UPLOAD_TYPES.join(",")}
              className="hidden"
              onChange={(e) => { if (e.target.files?.length) void addFiles(e.target.files); e.target.value = ""; }}
            />
          </div>

          {items.length > 0 && (
            <ul className="flex flex-col gap-2">
              {items.map((i) => (
                <UploadRow
                  key={i.id}
                  item={i}
                  categories={categories}
                  editable={editable(i)}
                  showErrors={showErrors}
                  running={running}
                  onChange={(p) => patch(i.id, p)}
                  onRemove={() => remove(i.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function UploadRow({ item: i, categories, editable, showErrors, running, onChange, onRemove }: {
  item: Item;
  categories: CategoryOption[];
  editable: boolean;
  showErrors: boolean;
  running: boolean;
  onChange: (p: Partial<Item>) => void;
  onRemove: () => void;
}) {
  const res = resolutionOf(i.width, i.height);
  const mobile = i.height / i.width >= 0.9;
  const border = i.status === "failed" ? "rgba(239,68,68,0.45)" : i.status === "done" ? (i.result?.warnings.length ? "rgba(245,158,11,0.45)" : "rgba(129,238,78,0.35)") : "var(--border)";
  const missingTitle = showErrors && editable && !i.title.trim();
  const missingCategory = showErrors && editable && !i.categoryId;

  return (
    <li className="rounded-xl p-3 flex gap-3" style={{ background: "var(--bg-secondary)", border: `1px solid ${border}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={i.previewUrl} alt="" className="w-28 h-20 rounded-md object-cover shrink-0" style={{ background: "#111" }} />
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <input
            aria-label={`Title for ${i.file.name}`}
            value={i.title}
            maxLength={120}
            disabled={!editable}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Title"
            className="flex-[2_1_220px] min-w-0 rounded-lg px-3 py-1.5 text-sm disabled:opacity-70"
            style={{ ...inputStyle, ...(missingTitle ? { borderColor: "#ef4444" } : {}) }}
          />
          <select
            aria-label={`Category for ${i.file.name}`}
            value={i.categoryId}
            disabled={!editable}
            onChange={(e) => onChange({ categoryId: e.target.value })}
            className="flex-[1_1_150px] min-w-0 rounded-lg px-2 py-1.5 text-sm disabled:opacity-70"
            style={{ ...inputStyle, ...(missingCategory ? { borderColor: "#ef4444" } : {}) }}
          >
            <option value="">Category…</option>
            <option value={AUTO}>✨ Auto (AI)</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input
            aria-label={`Tags for ${i.file.name}`}
            value={i.tagsText}
            disabled={!editable}
            onChange={(e) => onChange({ tagsText: e.target.value })}
            placeholder="Tags, comma separated"
            className="flex-[2_1_200px] min-w-0 rounded-lg px-3 py-1.5 text-sm disabled:opacity-70"
            style={inputStyle}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
          <span className="truncate max-w-[220px]" title={i.file.name}>{i.file.name}</span>
          <span>{i.width}×{i.height}</span>
          <span>{res.label}</span>
          <span>{mobile ? "Mobile" : "Desktop"}</span>
          <span>{i.file.size >= MB ? `${(i.file.size / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(i.file.size / 1024))} KB`}</span>
          <span className="flex-1" />
          <RowStatus item={i} />
        </div>
        {i.status === "failed" && i.error && <p className="text-xs" style={{ color: "#ef4444" }}>{i.error}</p>}
        {i.status === "done" && i.result && i.result.warnings.length > 0 && (
          <ul className="text-xs flex flex-col gap-0.5" style={{ color: "#f59e0b" }}>
            {i.result.warnings.map((w) => <li key={w}>⚠ {w}</li>)}
          </ul>
        )}
      </div>
      {!running && i.status !== "done" && (
        <button onClick={onRemove} aria-label={`Remove ${i.file.name}`} title="Remove" className="self-start p-1.5 rounded hover:bg-white/5" style={{ color: "var(--text-muted)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      )}
    </li>
  );
}

function RowStatus({ item: i }: { item: Item }) {
  if (i.status === "ready") return <span>Ready</span>;
  if (i.status === "uploading")
    return (
      <span className="flex items-center gap-2" aria-label={`Uploading ${Math.round(i.progress * 100)}%`}>
        <span className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
          <span className="block h-full rounded-full transition-[width]" style={{ width: `${Math.round(i.progress * 100)}%`, background: "var(--accent)" }} />
        </span>
        <span className="tabular-nums">{Math.round(i.progress * 100)}%</span>
      </span>
    );
  if (i.status === "processing") return <span style={{ color: "var(--text-secondary)" }}>Processing…</span>;
  if (i.status === "failed") return <span style={{ color: "#ef4444" }}>Failed</span>;
  return (
    <span className="flex items-center gap-2">
      {i.result && (
        <span title={i.result.category.auto ? "Picked by the AI" : undefined} style={{ color: "var(--text-secondary)" }}>
          {i.result.category.name}{i.result.category.auto ? " ✨" : ""}
        </span>
      )}
      {i.result && <StatusBadge status={i.result.status} />}
      {i.result && (
        <Link href={`/admin/wallpapers?q=${encodeURIComponent(i.title)}`} className="underline" style={{ color: "var(--text-secondary)" }}>
          View
        </Link>
      )}
    </span>
  );
}
