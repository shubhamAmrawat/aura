"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  UPLOAD_MAX_BYTES,
  UPLOAD_MAX_FILES,
  UPLOAD_MIN_EDGE,
  UPLOAD_TYPES,
  analyzeUpload,
  createAdminUpload,
  discardUpload,
  getCategoryOptions,
  putFileToStorage,
  requestUploadSlots,
  resolutionOf,
  type CategoryOption,
} from "@/lib/adminApi";
import { useToast } from "@/lib/toast";
import { StatusBadge, Toggle, inputStyle } from "../_components/ui";
import { readImageHeaderSize } from "@/lib/imageSize";

/**
 * Bulk upload, review first:
 *   queued → uploading (PUT to storage) → analysing (size, colours, safety check, AI title /
 *   description / tags / category) → review (edit anything) → publishing → done.
 * Nothing is published until "Publish". Removing a file deletes it from storage; drafts left
 * unpublished are deleted by the server after 24 hours.
 */
type Status = "queued" | "uploading" | "analysing" | "review" | "publishing" | "done" | "failed";
/** Where a failed file stopped, so "Retry" continues from there. */
type Stage = "upload" | "analyse" | "publish";

type Item = {
  id: string;
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  title: string;
  description: string;
  categoryId: string;
  tagsText: string;
  /** fields the admin changed by hand — the AI never overwrites these */
  edited: { title: boolean; description: boolean; category: boolean; tags: boolean };
  status: Status;
  failedAt?: Stage;
  progress: number;
  error?: string;
  key?: string;
  fileUrl?: string;
  /** the AI's category pick and how sure it is */
  ai?: { categoryId: string | null; confidence: number; warnings: string[] };
  result?: { id: string; status: string; warnings: string[]; category: { name: string; auto: boolean } };
};
type Defaults = { categoryId: string; tagsText: string; isPremium: boolean; isAiGenerated: boolean; publish: boolean; aiText: boolean };

/** Files uploaded + analysed at the same time (the server also limits its own image work). */
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

const NOT_EDITED = { title: false, description: false, category: false, tags: false };

export default function BulkUploadPage() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [defaults, setDefaults] = useState<Defaults>({ categoryId: AUTO, tagsText: "", isPremium: false, isAiGenerated: false, publish: true, aiText: true });
  const [items, setItems] = useState<Item[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;
  const inputRef = useRef<HTMLInputElement>(null);
  /** ids removed while their upload/analysis was still running — cleaned up when it finishes */
  const removedRef = useRef(new Set<string>());
  const pumping = useRef(false);

  useEffect(() => {
    getCategoryOptions().then(setCategories).catch(() => toast("Couldn't load categories", "error"));
  }, [toast]);

  // Free the preview blobs when leaving the page
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.previewUrl)), []);

  const patch = useCallback((id: string, p: Partial<Item>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i)));
  }, []);

  const counts = useMemo(() => {
    const c = { queued: 0, uploading: 0, analysing: 0, review: 0, publishing: 0, done: 0, failed: 0, warnings: 0, pending: 0, failedPublish: 0 };
    for (const i of items) {
      c[i.status]++;
      if (i.status === "failed" && i.failedAt === "publish") c.failedPublish++;
      if (i.result?.warnings.length) c.warnings++;
      if (i.result?.status === "pending") c.pending++;
    }
    return c;
  }, [items]);
  const preparing = counts.queued + counts.uploading + counts.analysing;
  const unpublished = items.filter((i) => i.status !== "done").length;

  // Warn before closing the tab while files are uploading or waiting to be published
  useEffect(() => {
    if (!preparing && !publishing && !counts.review) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [preparing, publishing, counts.review]);

  // ── Step 1: upload + analyse (starts as soon as files are added) ─────────
  /** PUT the file to storage (fresh link on retry), then ask the server to analyse it. */
  const prepareOne = async (id: string): Promise<void> => {
    const item = itemsRef.current.find((i) => i.id === id);
    if (!item) return;
    let key = item.key;
    let fileUrl = item.fileUrl;

    if (!key || !fileUrl) {
      for (let attempt = 0; ; attempt++) {
        patch(id, { status: "uploading", progress: 0, error: undefined });
        const s = await requestUploadSlots([{ fileType: item.file.type, fileSizeBytes: item.file.size }]);
        if (!s.ok) {
          if (attempt < RETRIES && retryable(s.status)) { await sleep(1500 * (attempt + 1)); continue; }
          patch(id, { status: "failed", failedAt: "upload", error: s.error });
          return;
        }
        const slot = s.data.items[0]!;
        const putStatus = await putFileToStorage(slot.uploadUrl, item.file, (f) => patch(id, { progress: f }));
        if (putStatus >= 200 && putStatus < 300) { key = slot.key; fileUrl = slot.fileUrl; break; }
        if (attempt < RETRIES && retryable(putStatus)) { await sleep(1500 * (attempt + 1)); continue; }
        patch(id, { status: "failed", failedAt: "upload", error: putStatus ? `Storage refused the file (${putStatus})` : "Upload interrupted — check your connection" });
        return;
      }
      patch(id, { key, fileUrl });
    }
    if (removedRef.current.has(id)) { void discardUpload(key!); return; }

    patch(id, { status: "analysing", progress: 1, error: undefined });
    for (let attempt = 0; ; attempt++) {
      const latest = itemsRef.current.find((i) => i.id === id) ?? item;
      const r = await analyzeUpload({
        key: key!, fileUrl: fileUrl!, fileType: item.file.type, fileSizeBytes: item.file.size,
        title: titleFromName(item.file.name), tags: parseTags(latest.tagsText),
      });
      if (removedRef.current.has(id)) { void discardUpload(key!); return; }
      if (r.ok) {
        const draft = r.data;
        const d = defaultsRef.current;
        setItems((prev) => prev.map((i) => {
          if (i.id !== id) return i;
          const next: Item = { ...i, status: "review", failedAt: undefined, width: draft.width, height: draft.height, ai: { categoryId: draft.category?.id ?? null, confidence: draft.confidence, warnings: draft.warnings } };
          if (d.aiText && !i.edited.title && draft.title) next.title = draft.title;
          if (d.aiText && !i.edited.description && draft.description) next.description = draft.description;
          if (d.aiText && !i.edited.tags && draft.tags.length) next.tagsText = parseTags([i.tagsText, ...draft.tags].join(",")).join(", ");
          // The batch is on "Auto" and the admin hasn't picked one → use the AI's category
          if (!i.edited.category && i.categoryId === AUTO && draft.category) next.categoryId = draft.category.id;
          return next;
        }));
        return;
      }
      if (attempt < RETRIES && retryable(r.status) && r.status !== 403) { await sleep(2000 * (attempt + 1)); continue; }
      patch(id, { status: "failed", failedAt: "analyse", error: r.error });
      return;
    }
  };

  /** Works through queued files, a few at a time. Safe to call repeatedly. */
  const pump = useCallback(async () => {
    if (pumping.current) return;
    pumping.current = true;
    try {
      const running = new Set<Promise<void>>();
      for (;;) {
        const next = itemsRef.current.find((i) => i.status === "queued" && !removedRef.current.has(i.id));
        if (!next && running.size === 0) break;
        if (next && running.size < CONCURRENCY) {
          patch(next.id, { status: "uploading" });
          itemsRef.current = itemsRef.current.map((i) => (i.id === next.id ? { ...i, status: "uploading" } : i));
          const p: Promise<void> = prepareOne(next.id).finally(() => running.delete(p));
          running.add(p);
          continue;
        }
        await Promise.race(running);
      }
    } finally {
      pumping.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patch]);

  // ── Adding files ───────────────────────────────────────────
  const addFiles = async (list: FileList | File[]) => {
    const files = Array.from(list);
    const skipped: string[] = [];
    const existing = new Set(itemsRef.current.map((i) => `${i.file.name}:${i.file.size}`));
    let room = UPLOAD_MAX_FILES - itemsRef.current.filter((i) => i.status !== "done").length;
    // Quick checks first, then read every file's size in parallel from its header (no full image load).
    const accepted: File[] = [];
    for (const file of files) {
      if (!(UPLOAD_TYPES as readonly string[]).includes(file.type)) { skipped.push(`${file.name}: not JPEG, PNG or WebP`); continue; }
      if (file.size > UPLOAD_MAX_BYTES) { skipped.push(`${file.name}: larger than 25 MB`); continue; }
      if (existing.has(`${file.name}:${file.size}`)) { skipped.push(`${file.name}: already in the list`); continue; }
      if (room <= 0) { skipped.push(`${file.name}: batch is full (${UPLOAD_MAX_FILES} max)`); continue; }
      existing.add(`${file.name}:${file.size}`);
      room--;
      accepted.push(file);
    }
    const d = defaultsRef.current;
    const sized = await Promise.all(
      accepted.map(async (file) => {
        const previewUrl = URL.createObjectURL(file);
        const size = (await readImageHeaderSize(file)) ?? (await readSize(previewUrl));
        return { file, previewUrl, ...size };
      })
    );
    const added: Item[] = [];
    for (const { file, previewUrl, width, height } of sized) {
      if (!width) { URL.revokeObjectURL(previewUrl); skipped.push(`${file.name}: couldn't read the image`); continue; }
      if (width < UPLOAD_MIN_EDGE || height < UPLOAD_MIN_EDGE) { URL.revokeObjectURL(previewUrl); skipped.push(`${file.name}: smaller than ${UPLOAD_MIN_EDGE}×${UPLOAD_MIN_EDGE}`); continue; }
      added.push({
        id: crypto.randomUUID(), file, previewUrl, width, height,
        title: titleFromName(file.name), description: "", categoryId: d.categoryId, tagsText: d.tagsText,
        edited: { ...NOT_EDITED }, status: "queued", progress: 0,
      });
    }
    if (added.length) {
      itemsRef.current = [...itemsRef.current, ...added];
      setItems((prev) => [...prev, ...added]);
      void pump();
    }
    if (skipped.length) {
      toast(skipped.length === 1 ? `Skipped ${skipped[0]}` : `Skipped ${skipped.length} files — ${skipped.slice(0, 3).join("; ")}${skipped.length > 3 ? "…" : ""}`, "error");
    }
  };

  const remove = (id: string) => {
    const it = itemsRef.current.find((i) => i.id === id);
    if (!it) return;
    if (it.status === "uploading" || it.status === "analysing") removedRef.current.add(id); // cleaned up when that step ends
    else if (it.key && it.status !== "done") void discardUpload(it.key);
    URL.revokeObjectURL(it.previewUrl);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const applyDefaults = () => {
    setItems((prev) => prev.map((i) => {
      if (i.status === "done" || i.status === "publishing") return i;
      const category = defaults.categoryId === AUTO ? (i.ai?.categoryId ?? AUTO) : defaults.categoryId || i.categoryId;
      return { ...i, categoryId: category, tagsText: parseTags([defaults.tagsText, i.tagsText].join(",")).join(", "), edited: { ...i.edited, category: defaults.categoryId !== AUTO, tags: true } };
    }));
    toast("Applied to every file that isn't published yet.", "success");
  };

  const clearFinished = () => {
    setItems((prev) => {
      prev.filter((i) => i.status === "done").forEach((i) => URL.revokeObjectURL(i.previewUrl));
      return prev.filter((i) => i.status !== "done");
    });
  };

  const retryFailed = () => {
    const toPrepare = itemsRef.current.filter((i) => i.status === "failed" && i.failedAt !== "publish");
    if (toPrepare.length) {
      const ids = new Set(toPrepare.map((i) => i.id));
      itemsRef.current = itemsRef.current.map((i) => (ids.has(i.id) ? { ...i, status: "queued", error: undefined } : i));
      setItems((prev) => prev.map((i) => (ids.has(i.id) ? { ...i, status: "queued", error: undefined } : i)));
      void pump();
    }
    if (itemsRef.current.some((i) => i.status === "failed" && i.failedAt === "publish")) void publish(true);
  };

  // ── Step 2: publish what the admin reviewed ─────────────────
  const publishOne = async (id: string): Promise<boolean> => {
    const it = itemsRef.current.find((i) => i.id === id);
    if (!it || !it.key || !it.fileUrl) return false;
    const d = defaultsRef.current;
    patch(id, { status: "publishing", error: undefined });
    const payload = {
      key: it.key, fileUrl: it.fileUrl, fileType: it.file.type, fileSizeBytes: it.file.size,
      width: it.width, height: it.height,
      title: it.title.trim(), description: it.description.trim() || null, tags: parseTags(it.tagsText), categoryId: it.categoryId,
      isPremium: d.isPremium, isAiGenerated: d.isAiGenerated, publish: d.publish,
      // what's on screen is final — the AI's suggestions are already in the fields
      aiTitle: false, aiText: false,
    };
    for (let attempt = 0; ; attempt++) {
      const r = await createAdminUpload(payload);
      if (r.ok) {
        patch(id, { status: "done", title: r.data.wallpaper.title, result: { id: r.data.wallpaper.id, status: r.data.wallpaper.status, warnings: r.data.warnings, category: r.data.category } });
        return true;
      }
      if (attempt < RETRIES && retryable(r.status) && r.status !== 403) { await sleep(2000 * (attempt + 1)); continue; }
      patch(id, { status: "failed", failedAt: "publish", error: r.error });
      return false;
    }
  };

  const publish = async (onlyFailed = false) => {
    const queue = itemsRef.current.filter((i) => (onlyFailed ? i.status === "failed" && i.failedAt === "publish" : i.status === "review" || (i.status === "failed" && i.failedAt === "publish")));
    if (!queue.length) return;
    const invalid = queue.filter((i) => !i.title.trim() || !i.categoryId);
    if (invalid.length) {
      setShowErrors(true);
      toast(`${invalid.length} file${invalid.length === 1 ? " needs" : "s need"} a title and a category.`, "error");
      return;
    }
    setShowErrors(false);
    setPublishing(true);
    try {
      let next = 0;
      let ok = 0;
      const worker = async () => {
        while (next < queue.length) {
          const it = queue[next++]!;
          if (await publishOne(it.id)) ok++;
        }
      };
      await Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker));
      const bad = queue.length - ok;
      toast(
        bad
          ? `${ok} published, ${bad} failed — retry the failed ones.`
          : `${ok} wallpaper${ok === 1 ? "" : "s"} ${defaultsRef.current.publish ? "published" : "sent to the review queue"}.`,
        bad ? "error" : "success"
      );
    } finally {
      setPublishing(false);
    }
  };

  const editable = (i: Item) => !publishing && i.status !== "publishing" && i.status !== "done";
  const ready = counts.review + counts.failedPublish;

  return (
    <div className="pb-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Bulk upload</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Up to {UPLOAD_MAX_FILES} images per batch · JPEG, PNG or WebP · 25 MB each. Files are analysed as soon as you add them — check the AI&apos;s title, description, tags and category, then publish.
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
              <select aria-label="Default category" value={defaults.categoryId} disabled={publishing} onChange={(e) => setDefaults((d) => ({ ...d, categoryId: e.target.value }))} className="rounded-lg px-3 py-2 text-sm" style={inputStyle}>
                <option value="">Choose a category</option>
                <option value={AUTO}>✨ AI picks from the image</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>Tags (comma separated)</span>
              <input aria-label="Default tags" value={defaults.tagsText} disabled={publishing} onChange={(e) => setDefaults((d) => ({ ...d, tagsText: e.target.value }))} placeholder="e.g. dark, 4k" className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
            </label>
            <div className="flex flex-col">
              <Toggle label="AI title, description & tags" checked={defaults.aiText} disabled={publishing} onChange={(v) => setDefaults((d) => ({ ...d, aiText: v }))} />
              <p className="text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>
                {defaults.aiText
                  ? "Filled in for new files as soon as they're analysed. Anything you type yourself is kept."
                  : "Titles come from file names; descriptions and tags are only what you type."}
              </p>
              <Toggle label="Premium" checked={defaults.isPremium} disabled={publishing} onChange={(v) => setDefaults((d) => ({ ...d, isPremium: v }))} />
              <Toggle label="AI generated" checked={defaults.isAiGenerated} disabled={publishing} onChange={(v) => setDefaults((d) => ({ ...d, isAiGenerated: v }))} />
              <Toggle label="Publish immediately" checked={defaults.publish} disabled={publishing} onChange={(v) => setDefaults((d) => ({ ...d, publish: v }))} />
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {defaults.publish ? "Published files go live straight away." : "Published files wait in the Review queue until you approve them."}
              </p>
            </div>
            <button
              onClick={applyDefaults}
              disabled={publishing || !items.some((i) => i.status !== "done")}
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
                <dt>Analysing</dt><dd className="text-right tabular-nums">{preparing}</dd>
                <dt>Ready to publish</dt><dd className="text-right tabular-nums" style={{ color: counts.review ? "var(--text-primary)" : undefined }}>{counts.review}</dd>
                <dt>Published</dt><dd className="text-right tabular-nums" style={{ color: counts.done ? "var(--accent)" : undefined }}>{counts.done}</dd>
                <dt>Failed</dt><dd className="text-right tabular-nums" style={{ color: counts.failed ? "#ef4444" : undefined }}>{counts.failed}</dd>
                {counts.warnings > 0 && <><dt>With warnings</dt><dd className="text-right tabular-nums" style={{ color: "#f59e0b" }}>{counts.warnings}</dd></>}
              </dl>
              <button
                onClick={() => void publish(false)}
                disabled={publishing || ready === 0}
                className="text-sm font-semibold px-4 py-2.5 rounded-lg disabled:opacity-40"
                style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
              >
                {publishing
                  ? `Publishing… ${counts.done}/${counts.done + counts.publishing + ready}`
                  : ready === 0
                    ? preparing ? `Analysing ${preparing} file${preparing === 1 ? "" : "s"}…` : counts.done ? "All published" : "Nothing to publish"
                    : `${defaults.publish ? "Publish" : "Send"} ${ready} file${ready === 1 ? "" : "s"}${defaults.publish ? "" : " to review"}`}
              </button>
              {ready > 0 && preparing > 0 && !publishing && (
                <p className="text-[11px] -mt-1" style={{ color: "var(--text-muted)" }}>{preparing} still analysing — you can publish these now or wait.</p>
              )}
              <div className="flex gap-2">
                {counts.failed > 0 && !publishing && (
                  <button onClick={retryFailed} className="flex-1 text-xs px-3 py-2 rounded-lg hover:bg-white/5" style={{ border: "1px solid var(--border-hover)", color: "var(--text-primary)" }}>
                    Retry failed ({counts.failed})
                  </button>
                )}
                {counts.done > 0 && !publishing && (
                  <button onClick={clearFinished} className="flex-1 text-xs px-3 py-2 rounded-lg hover:bg-white/5" style={{ border: "1px solid var(--border-hover)", color: "var(--text-secondary)" }}>
                    Clear published
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
            onClick={() => !publishing && inputRef.current?.click()}
            onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !publishing) { e.preventDefault(); inputRef.current?.click(); } }}
            onDragOver={(e) => { e.preventDefault(); if (!publishing) setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!publishing && e.dataTransfer.files.length) void addFiles(e.dataTransfer.files); }}
            className="rounded-xl flex flex-col items-center justify-center text-center gap-2 cursor-pointer transition-colors"
            style={{
              minHeight: items.length ? 120 : 260,
              border: `1.5px dashed ${dragOver ? "var(--accent)" : "var(--border-hover)"}`,
              background: dragOver ? "rgba(129,238,78,0.06)" : "var(--bg-secondary)",
              opacity: publishing ? 0.5 : 1,
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: dragOver ? "var(--accent)" : "var(--text-muted)" }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Drop images here or <span style={{ color: "var(--accent)" }}>browse</span></p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{unpublished}/{UPLOAD_MAX_FILES} in this batch</p>
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
                  aiText={defaults.aiText}
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

function UploadRow({ item: i, categories, editable, showErrors, aiText, onChange, onRemove }: {
  item: Item;
  categories: CategoryOption[];
  editable: boolean;
  showErrors: boolean;
  /** batch setting: the AI fills title / description / tags */
  aiText: boolean;
  onChange: (p: Partial<Item>) => void;
  onRemove: () => void;
}) {
  const res = resolutionOf(i.width, i.height);
  const mobile = i.height / i.width >= 0.9;
  const waiting = i.status === "queued" || i.status === "uploading" || i.status === "analysing";
  const warnings = i.status === "done" ? i.result?.warnings ?? [] : i.ai?.warnings ?? [];
  const border =
    i.status === "failed" ? "rgba(239,68,68,0.45)"
      : warnings.length ? "rgba(245,158,11,0.45)"
        : i.status === "done" ? "rgba(129,238,78,0.35)"
          : "var(--border)";
  const missingTitle = showErrors && editable && !i.title.trim();
  const missingCategory = showErrors && editable && !i.categoryId;
  const aiCategory = i.ai?.categoryId && i.categoryId === i.ai.categoryId;
  const aiField = (k: keyof Item["edited"]) => waiting && aiText && !i.edited[k];
  const edit = (k: keyof Item["edited"], p: Partial<Item>) => onChange({ ...p, edited: { ...i.edited, [k]: true } });

  return (
    <li className="rounded-xl p-3 flex gap-3" style={{ background: "var(--bg-secondary)", border: `1px solid ${border}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={i.previewUrl} alt="" loading="lazy" decoding="async" className="w-28 h-20 rounded-md object-cover shrink-0" style={{ background: "#111" }} />
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <input
            aria-label={`Title for ${i.file.name}`}
            value={i.title}
            maxLength={120}
            disabled={!editable}
            onChange={(e) => edit("title", { title: e.target.value })}
            placeholder="Title"
            className="flex-[2_1_220px] min-w-0 rounded-lg px-3 py-1.5 text-sm disabled:opacity-70"
            style={{ ...inputStyle, ...(aiField("title") ? { color: "var(--text-muted)" } : {}), ...(missingTitle ? { borderColor: "#ef4444" } : {}) }}
          />
          <div className="flex-[1_1_150px] min-w-0 relative">
            <select
              aria-label={`Category for ${i.file.name}`}
              value={i.categoryId}
              disabled={!editable}
              onChange={(e) => edit("category", { categoryId: e.target.value })}
              className="w-full rounded-lg px-2 py-1.5 text-sm disabled:opacity-70"
              style={{ ...inputStyle, ...(missingCategory ? { borderColor: "#ef4444" } : {}) }}
            >
              <option value="">Category…</option>
              <option value={AUTO}>{waiting ? "✨ AI is picking…" : "✨ AI pick"}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{i.ai?.categoryId === c.id ? " ✨" : ""}
                </option>
              ))}
            </select>
          </div>
          <input
            aria-label={`Tags for ${i.file.name}`}
            value={i.tagsText}
            disabled={!editable}
            onChange={(e) => edit("tags", { tagsText: e.target.value })}
            placeholder={aiField("tags") ? "AI is adding tags…" : "Tags, comma separated"}
            className="flex-[2_1_200px] min-w-0 rounded-lg px-3 py-1.5 text-sm disabled:opacity-70"
            style={inputStyle}
          />
        </div>
        <textarea
          aria-label={`Description for ${i.file.name}`}
          value={i.description}
          maxLength={1000}
          rows={2}
          disabled={!editable}
          onChange={(e) => edit("description", { description: e.target.value })}
          placeholder={aiField("description") ? "AI is writing a description…" : "Description (optional)"}
          className="w-full rounded-lg px-3 py-1.5 text-xs leading-relaxed resize-y disabled:opacity-70"
          style={inputStyle}
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
          <span className="truncate max-w-[220px]" title={i.file.name}>{i.file.name}</span>
          <span>{i.width}×{i.height}</span>
          <span>{res.label}</span>
          <span>{mobile ? "Mobile" : "Desktop"}</span>
          <span>{i.file.size >= MB ? `${(i.file.size / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(i.file.size / 1024))} KB`}</span>
          {aiCategory && i.status === "review" && (
            <span style={{ color: (i.ai?.confidence ?? 0) < 0.7 ? "#f59e0b" : "var(--accent)" }}>
              ✨ Category picked by AI{(i.ai?.confidence ?? 0) < 0.7 ? " (unsure)" : ""}
            </span>
          )}
          <span className="flex-1" />
          <RowStatus item={i} />
        </div>
        {i.status === "failed" && i.error && <p className="text-xs" style={{ color: "#ef4444" }}>{i.error}</p>}
        {warnings.length > 0 && (
          <ul className="text-xs flex flex-col gap-0.5" style={{ color: "#f59e0b" }}>
            {warnings.map((w) => <li key={w}>⚠ {w}</li>)}
          </ul>
        )}
      </div>
      {i.status !== "done" && i.status !== "publishing" && (
        <button onClick={onRemove} aria-label={`Remove ${i.file.name}`} title="Remove" className="self-start p-1.5 rounded hover:bg-white/5" style={{ color: "var(--text-muted)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      )}
    </li>
  );
}

function RowStatus({ item: i }: { item: Item }) {
  if (i.status === "queued") return <span>Waiting…</span>;
  if (i.status === "uploading")
    return (
      <span className="flex items-center gap-2" aria-label={`Uploading ${Math.round(i.progress * 100)}%`}>
        <span className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
          <span className="block h-full rounded-full transition-[width]" style={{ width: `${Math.round(i.progress * 100)}%`, background: "var(--accent)" }} />
        </span>
        <span className="tabular-nums">{Math.round(i.progress * 100)}%</span>
      </span>
    );
  if (i.status === "analysing") return <span style={{ color: "var(--text-secondary)" }}>✨ Analysing…</span>;
  if (i.status === "review") return <span style={{ color: "var(--text-primary)" }}>Ready to publish</span>;
  if (i.status === "publishing") return <span style={{ color: "var(--text-secondary)" }}>Publishing…</span>;
  if (i.status === "failed") return <span style={{ color: "#ef4444" }}>{i.failedAt === "publish" ? "Publish failed" : i.failedAt === "analyse" ? "Analysis failed" : "Upload failed"}</span>;
  return (
    <span className="flex items-center gap-2">
      {i.result && (
        <span title={i.result.category.auto ? "Picked by the AI" : undefined} style={{ color: "var(--text-secondary)" }}>
          {i.result.category.name}
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
