"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import { getCategories, getUploadUrl, submitWallpaper } from "@/lib/api";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_BYTES = 25 * 1024 * 1024;
const MIN_IMAGE_DIMENSION = 200;

function meetsMinImageSize(width: number, height: number): boolean {
  return width >= MIN_IMAGE_DIMENSION && height >= MIN_IMAGE_DIMENSION;
}

type Progress = "idle" | "uploading" | "moderating" | "saving" | "done";

const PROGRESS_STEPS: {
  key: Progress;
  label: string;
  sublabel: string;
}[] = [
  {
    key: "uploading",
    label: "Uploading image",
    sublabel: "Sending your wallpaper to secure storage",
  },
  {
    key: "moderating",
    label: "Safety check",
    sublabel: "AI is reviewing your image for content policy",
  },
  {
    key: "saving",
    label: "Finalizing",
    sublabel: "Extracting metadata and generating visual index",
  },
  {
    key: "done",
    label: "Complete",
    sublabel: "Your wallpaper is live",
  },
];

const STEP_INDEX: Record<Progress, number> = {
  idle: -1,
  uploading: 0,
  moderating: 1,
  saving: 2,
  done: 3,
};

const PROGRESS_WIDTH: Record<Progress, string> = {
  idle: "0%",
  uploading: "20%",
  moderating: "50%",
  saving: "80%",
  done: "100%",
};

type Category = { id: string; name: string; slug: string };

function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "-");
}

function loadImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement("img");
    el.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: el.naturalWidth, height: el.naturalHeight });
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image dimensions"));
    };
    el.src = url;
  });
}

async function validateImageFile(
  file: File
): Promise<{ error: string | null; dims?: { width: number; height: number } }> {
  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    return { error: "Only JPEG, PNG, or WebP images are allowed." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "File must be 25 MB or smaller." };
  }
  try {
    const { width, height } = await loadImageDimensions(file);
    if (!meetsMinImageSize(width, height)) {
      return {
        error: `Image must be at least ${MIN_IMAGE_DIMENSION}×${MIN_IMAGE_DIMENSION} pixels (this file is ${width}×${height}).`,
      };
    }
    return { error: null, dims: { width, height } };
  } catch {
    return { error: "Could not read this image. Try another file." };
  }
}

const inputBorder = (focused: boolean): CSSProperties => ({
  border: `1px solid ${focused ? "var(--accent)" : "var(--border)"}`,
  background: "var(--bg-elevated)",
  color: "var(--text-primary)",
  borderRadius: "0.75rem",
  outline: "none",
});

/** DevTools: filter by `[Aurora upload]` to trace presign → R2 PUT → submit. */
function uploadLog(...args: unknown[]) {
  console.log("[Aurora upload]", ...args);
}

function uploadWarn(...args: unknown[]) {
  console.warn("[Aurora upload]", ...args);
}

function safeUrlHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "(unparseable URL)";
  }
}

type UploadPhase = "presign" | "storage_put" | "submit";

function uploadFailureMessage(phase: UploadPhase, err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const isNetwork = raw === "Failed to fetch" || raw === "Load failed" || raw === "NetworkError when attempting to fetch resource.";

  if (!isNetwork) return raw;

  if (phase === "presign") {
    return `${raw} — could not reach the API for a presigned URL. Confirm NEXT_PUBLIC_API_URL and that the API is running (see Network tab for /api/wallpapers/upload-url).`;
  }
  if (phase === "storage_put") {
    return `${raw} — browser could not PUT the file to object storage. This is usually R2/S3 CORS: the bucket must allow PUT (and OPTIONS) from your site origin (e.g. http://localhost:3000). The failing request host in Network tab should be your R2 endpoint, not your API.`;
  }
  return `${raw} — could not reach the API to save wallpaper metadata (see Network tab for /api/wallpapers/upload).`;
}

export default function UploadPage() {
  const router = useRouter();
  const { user, loaded } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dims, setDims] = useState<{ width: number; height: number } | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const [focusField, setFocusField] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [categoryHighlightIndex, setCategoryHighlightIndex] = useState(0);
  const categoryMenuRef = useRef<HTMLDivElement>(null);
  const categoryTriggerRef = useRef<HTMLButtonElement>(null);
  const categoryListboxRef = useRef<HTMLDivElement>(null);
  const categoryOpenIntentRef = useRef<"default" | "last">("default");

  const [error, setError] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress>("idle");

  useEffect(() => {
    if (!loaded) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!user.isCreator) {
      router.replace("/profile");
    }
  }, [loaded, user, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getCategories();
        if (!cancelled) setCategories(data);
      } catch {
        if (!cancelled) setCategories([]);
      } finally {
        if (!cancelled) setCategoriesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const closeCategoryMenu = useCallback((opts?: { focusTrigger?: boolean }) => {
    setCategoryMenuOpen(false);
    setCategoryHighlightIndex(0);
    if (opts?.focusTrigger) categoryTriggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!categoryMenuOpen || categoriesLoading || categories.length === 0) return;
    const intent = categoryOpenIntentRef.current;
    categoryOpenIntentRef.current = "default";
    let idx = categories.findIndex((c) => c.id === categoryId);
    if (intent === "last") idx = categories.length - 1;
    else if (idx < 0) idx = 0;
    setCategoryHighlightIndex(idx);
  }, [categoryMenuOpen, categoriesLoading, categories, categoryId]);

  useEffect(() => {
    if (!categoryMenuOpen || categoriesLoading || categories.length === 0) return;
    categoryListboxRef.current?.focus({ preventScroll: true });
  }, [categoryMenuOpen, categoriesLoading, categories.length]);

  useEffect(() => {
    if (!categoryMenuOpen || categories.length === 0) return;
    const idx = Math.min(Math.max(0, categoryHighlightIndex), categories.length - 1);
    const id = categories[idx]?.id;
    if (!id) return;
    document.getElementById(`upload-cat-option-${id}`)?.scrollIntoView({ block: "nearest" });
  }, [categoryMenuOpen, categoryHighlightIndex, categories]);

  useEffect(() => {
    if (!categoryMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const root = categoryMenuRef.current;
      if (root && !root.contains(e.target as Node)) closeCategoryMenu();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (categoryListboxRef.current?.contains(document.activeElement)) return;
      closeCategoryMenu();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [categoryMenuOpen, closeCategoryMenu]);

  const onCategoryTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (categoriesLoading || busy || categories.length === 0) return;
    if (e.key === "ArrowDown" && !categoryMenuOpen) {
      e.preventDefault();
      categoryOpenIntentRef.current = "default";
      setCategoryMenuOpen(true);
      return;
    }
    if (e.key === "ArrowUp" && !categoryMenuOpen) {
      e.preventDefault();
      categoryOpenIntentRef.current = "last";
      setCategoryMenuOpen(true);
    }
  };

  const onCategoryListboxKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (categories.length === 0) return;
    const last = categories.length - 1;

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        setCategoryHighlightIndex((i) => Math.min(last, i + 1));
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        setCategoryHighlightIndex((i) => Math.max(0, i - 1));
        break;
      }
      case "Home": {
        e.preventDefault();
        setCategoryHighlightIndex(0);
        break;
      }
      case "End": {
        e.preventDefault();
        setCategoryHighlightIndex(last);
        break;
      }
      case "Enter":
      case " ": {
        e.preventDefault();
        const idx = Math.min(Math.max(0, categoryHighlightIndex), last);
        const c = categories[idx];
        if (c) {
          setCategoryId(c.id);
          closeCategoryMenu({ focusTrigger: true });
        }
        break;
      }
      case "Escape": {
        e.preventDefault();
        e.stopPropagation();
        closeCategoryMenu({ focusTrigger: true });
        break;
      }
      case "Tab": {
        closeCategoryMenu();
        break;
      }
      default:
        break;
    }
  };

  const clearFile = useCallback(() => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setFile(null);
    setDims(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const applyValidFile = useCallback(async (next: File) => {
    setError(null);
    const { error: validationError, dims: nextDims } = await validateImageFile(next);
    if (validationError || !nextDims) {
      setError(validationError);
      return;
    }
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(next);
    });
    setFile(next);
    setDims(nextDims);
  }, []);

  const onFileChosen = useCallback(
    async (f: File | undefined) => {
      if (!f) return;
      await applyValidFile(f);
    },
    [applyValidFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      void onFileChosen(f);
    },
    [onFileChosen]
  );

  const addTagsFromString = useCallback(
    (raw: string) => {
      const parts = raw.split(",").map((p) => normalizeTag(p)).filter(Boolean);
      if (parts.length === 0) return;
      setTags((prev) => {
        const next = [...prev];
        for (const p of parts) {
          if (next.length >= 10) break;
          if (!next.includes(p)) next.push(p);
        }
        return next;
      });
      setTagInput("");
    },
    []
  );

  const onTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTagsFromString(tagInput);
      return;
    }
    if (e.key === ",") {
      e.preventDefault();
      addTagsFromString(tagInput);
    }
  };

  const removeTag = (t: string) => {
    setTags((prev) => prev.filter((x) => x !== t));
  };

  const busy = progress !== "idle";

  const selectedCategoryName = categories.find((c) => c.id === categoryId)?.name ?? null;

  const canSubmit =
    !busy &&
    !pendingMessage &&
    Boolean(file) &&
    title.trim().length > 0 &&
    Boolean(categoryId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !dims) return;
    if (!title.trim() || !categoryId) return;

    setError(null);
    setPendingMessage(null);
    closeCategoryMenu();
    setProgress("uploading");

    let phase: UploadPhase = "presign";

    try {
      uploadLog("step 1/3 presign: requesting upload-url", { fileType: file.type, size: file.size });
      const { uploadUrl, fileUrl, key } = await getUploadUrl(file.type);
      uploadLog("step 1/3 presign: OK", {
        key,
        fileUrlHost: safeUrlHost(fileUrl),
        putHost: safeUrlHost(uploadUrl),
      });

      phase = "storage_put";
      uploadLog("step 2/3 storage: PUT file to presigned URL", {
        host: safeUrlHost(uploadUrl),
        contentType: file.type,
      });
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      uploadLog("step 2/3 storage: response", { ok: putRes.ok, status: putRes.status, statusText: putRes.statusText });
      if (!putRes.ok) {
        const bodySnippet = await putRes.text().catch(() => "");
        uploadWarn("step 2/3 storage: non-OK body (truncated)", bodySnippet.slice(0, 500));
        throw new Error(`Upload to storage failed (${putRes.status}).`);
      }
      uploadLog("step 2/3 storage: OK");

      setProgress("moderating");
      phase = "submit";
      uploadLog("step 3/3 submit: POST /api/wallpapers/upload", { key, fileUrlHost: safeUrlHost(fileUrl) });
      const result = await submitWallpaper({
        title: title.trim().slice(0, 100),
        description: description.trim().slice(0, 500),
        categoryId,
        tags,
        fileUrl,
        key,
        width: dims.width,
        height: dims.height,
        fileSizeBytes: file.size,
        fileType: file.type,
      });
      uploadLog("step 3/3 submit: OK", {
        moderationStatus: result.moderationStatus,
        wallpaperId: result.wallpaper?.id,
      });

      if (result.moderationStatus === "approved") {
        const id = result.wallpaper?.id as string | undefined;
        setProgress("done");
        uploadLog("complete: approved, redirect", { id });
        if (id) router.push(`/wallpaper/${id}`);
        else router.push("/");
        return;
      }

      if (result.moderationStatus === "pending") {
        setProgress("idle");
        uploadLog("complete: pending, redirect to profile in 2s");
        setPendingMessage(
          result.message || "Your wallpaper is under review. You will be redirected to your profile."
        );
        setTimeout(() => {
          router.push("/profile");
        }, 2000);
        return;
      }

      setError("Unexpected response from server.");
      setProgress("idle");
    } catch (err) {
      console.error("[Aurora upload] FAILED", { phase, err });
      setProgress("idle");
      setError(uploadFailureMessage(phase, err));
    }
  };

  if (!loaded || !user || !user.isCreator) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-6" style={{ background: "var(--bg-primary)" }}>
        <p className="text-xs tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>
          Loading
        </p>
        <div
          className="w-full max-w-[200px] h-1 rounded-full overflow-hidden"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
        >
          <div
            className="h-full rounded-full w-[35%] animate-[upload-bar-indeterminate_1.1s_ease-in-out_infinite]"
            style={{ background: "var(--accent)" }}
          />
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen pt-24 px-4 sm:px-8 md:px-12 pb-16"
      style={{ background: "var(--bg-primary)" }}
    >
      <div className="max-w-5xl mx-auto">
        <Link
          href="/"
          className="text-xs tracking-widest uppercase inline-block mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--accent)" }}
        >
          ← Home
        </Link>

        <h1 className="text-2xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
          Upload wallpaper
        </h1>
        <p className="text-sm mb-8 max-w-xl" style={{ color: "var(--text-muted)" }}>
          Add a high-resolution image, details, and tags. Files are scanned for safety before publishing.
        </p>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
          {/* Left: dropzone / preview */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_TYPES.join(",")}
              className="hidden"
              aria-label="Choose wallpaper image file"
              onChange={(e) => void onFileChosen(e.target.files?.[0])}
            />

            {!previewUrl ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className="w-full min-h-[360px] rounded-2xl flex flex-col items-center justify-center gap-3 px-6 py-10 transition-colors"
                style={{
                  border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border)"}`,
                  background: "var(--bg-elevated)",
                }}
              >
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                  Drop an image here or click to browse
                </p>
                <p className="text-xs text-center max-w-xs" style={{ color: "var(--text-muted)" }}>
                  JPEG, PNG, or WebP · max 25 MB · min {MIN_IMAGE_DIMENSION}×{MIN_IMAGE_DIMENSION}px
                </p>
              </button>
            ) : (
              <div className="rounded-2xl overflow-hidden relative" style={{ border: "1px solid var(--border)", background: "var(--bg-elevated)" }}>
                <div className="relative w-full aspect-[16/10] max-h-[420px]">
                  <Image
                    src={previewUrl}
                    alt="Preview"
                    fill
                    className="object-contain"
                    unoptimized
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                </div>
                {dims && (
                  <div
                    className="absolute top-3 right-3 text-[10px] font-medium px-2 py-1 rounded-md"
                    style={{ background: "var(--bg-primary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                  >
                    {dims.width} × {dims.height}
                  </div>
                )}
                <div className="p-3 flex justify-end" style={{ borderTop: "1px solid var(--border)" }}>
                  <button
                    type="button"
                    onClick={clearFile}
                    disabled={busy}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80 disabled:opacity-40"
                    style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                  >
                    Remove file
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: form */}
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-[10px] tracking-widest uppercase block mb-1.5" style={{ color: "var(--text-muted)" }}>
                Title <span style={{ color: "var(--accent)" }}>*</span>
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 100))}
                onFocus={() => setFocusField("title")}
                onBlur={() => setFocusField(null)}
                maxLength={100}
                placeholder="A short, descriptive title"
                className="w-full px-3 py-2.5 text-sm transition-colors"
                style={inputBorder(focusField === "title")}
              />
              <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>{title.length}/100</p>
            </div>

            <div>
              <label className="text-[10px] tracking-widest uppercase block mb-1.5" style={{ color: "var(--text-muted)" }}>
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                onFocus={() => setFocusField("desc")}
                onBlur={() => setFocusField(null)}
                rows={4}
                placeholder="Optional — tools used, mood, or story behind the piece"
                className="w-full px-3 py-2.5 text-sm resize-y min-h-[100px] transition-colors"
                style={inputBorder(focusField === "desc")}
              />
              <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>{description.length}/500</p>
            </div>

            <div ref={categoryMenuRef} className="relative">
              <label className="text-[10px] tracking-widest uppercase block mb-1.5" style={{ color: "var(--text-muted)" }}>
                Category <span style={{ color: "var(--accent)" }}>*</span>
              </label>
              <button
                ref={categoryTriggerRef}
                type="button"
                id="upload-category-trigger"
                aria-haspopup="listbox"
                aria-expanded={categoryMenuOpen ? "true" : "false"}
                aria-controls="upload-category-listbox"
                disabled={categoriesLoading || busy}
                onClick={() => {
                  setCategoryMenuOpen((open) => {
                    if (open) {
                      setCategoryHighlightIndex(0);
                      return false;
                    }
                    categoryOpenIntentRef.current = "default";
                    return true;
                  });
                }}
                onKeyDown={onCategoryTriggerKeyDown}
                onFocus={() => setFocusField("cat")}
                onBlur={() => setFocusField(null)}
                className="w-full px-3 py-2.5 text-sm text-left flex items-center justify-between gap-2 transition-colors disabled:opacity-50"
                style={inputBorder(focusField === "cat" || categoryMenuOpen)}
              >
                <span style={{ color: selectedCategoryName ? "var(--text-primary)" : "var(--text-muted)" }}>
                  {categoriesLoading ? "Loading categories…" : selectedCategoryName ?? "Select a category"}
                </span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text-muted)"
                  strokeWidth="2"
                  className={`shrink-0 transition-transform ${categoryMenuOpen ? "rotate-180" : ""}`}
                  aria-hidden
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {categoryMenuOpen && !categoriesLoading && (
                <div
                  ref={categoryListboxRef}
                  id="upload-category-listbox"
                  role="listbox"
                  tabIndex={-1}
                  aria-labelledby="upload-category-trigger"
                  aria-activedescendant={
                    categories.length > 0
                      ? `upload-cat-option-${categories[Math.min(categoryHighlightIndex, categories.length - 1)]!.id}`
                      : undefined
                  }
                  onKeyDown={onCategoryListboxKeyDown}
                  className="absolute z-50 left-0 right-0 mt-1 py-1 rounded-xl shadow-lg overflow-y-auto upload-category-scroll outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]"
                  style={{
                    maxHeight: "min(16rem, calc(100vh - 12rem))",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
                  }}
                >
                  {categories.length === 0 ? (
                    <div
                      role="option"
                      aria-selected="false"
                      aria-disabled="true"
                      className="px-3 py-2.5 text-sm cursor-default"
                      style={{ color: "var(--text-muted)" }}
                    >
                      No categories available
                    </div>
                  ) : (
                    categories.map((c, i) => {
                      const selected = c.id === categoryId;
                      const hi = Math.min(Math.max(0, categoryHighlightIndex), categories.length - 1);
                      const activeDesc = i === hi;
                      return (
                        <div
                          key={c.id}
                          id={`upload-cat-option-${c.id}`}
                          role="option"
                          aria-selected={selected ? "true" : "false"}
                          className="w-full text-left px-3 py-2.5 text-sm transition-colors cursor-pointer hover:bg-white/[0.04]"
                          style={{
                            background: selected ? "var(--accent-muted)" : "transparent",
                            color: "var(--text-primary)",
                            boxShadow: activeDesc ? "inset 0 0 0 1px var(--accent)" : undefined,
                          }}
                          onMouseDown={(e) => e.preventDefault()}
                          onMouseEnter={() => setCategoryHighlightIndex(i)}
                          onClick={() => {
                            setCategoryId(c.id);
                            closeCategoryMenu();
                          }}
                        >
                          {c.name}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="text-[10px] tracking-widest uppercase block mb-1.5" style={{ color: "var(--text-muted)" }}>
                Tags (max 10)
              </label>
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={onTagKeyDown}
                onFocus={() => setFocusField("tags")}
                onBlur={() => setFocusField(null)}
                disabled={tags.length >= 10}
                placeholder={tags.length >= 10 ? "Maximum tags reached" : "Type and press Enter or comma"}
                className="w-full px-3 py-2.5 text-sm transition-colors"
                style={inputBorder(focusField === "tags")}
              />
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full text-xs"
                      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                    >
                      {t}
                      <button
                        type="button"
                        onClick={() => removeTag(t)}
                        className="p-0.5 rounded-full leading-none transition-opacity hover:opacity-70"
                        style={{ color: "var(--text-muted)" }}
                        aria-label={`Remove tag ${t}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div
                className="rounded-xl px-4 py-3 text-sm"
                style={{
                  border: "1px solid #ef4444",
                  background: "rgba(239, 68, 68, 0.08)",
                  color: "var(--text-primary)",
                }}
              >
                {error}
              </div>
            )}

            {pendingMessage && (
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{pendingMessage}</p>
            )}

            {progress !== "idle" && (
              <div
                className="rounded-2xl overflow-hidden mt-2"
                style={{ border: "1px solid var(--border)", background: "var(--bg-elevated)" }}
              >
                {/* animated progress bar at top */}
                <div className="h-0.5 w-full" style={{ background: "var(--bg-primary)" }}>
                  <div
                    className="h-full"
                    style={{
                      background: "linear-gradient(90deg, var(--accent), rgba(64,192,87,0.6))",
                      width: PROGRESS_WIDTH[progress],
                      transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                  />
                </div>

                {/* steps */}
                <div className="p-4 flex flex-col gap-2.5">
                  {PROGRESS_STEPS.map((step, i) => {
                    const activeIndex = STEP_INDEX[progress];
                    const isActive = i === activeIndex;
                    const isCompleted = progress === "done" || i < activeIndex;
                    const isPending = !isActive && !isCompleted;

                    return (
                      <div
                        key={step.key}
                        className="flex items-center gap-3 transition-all duration-300"
                        style={{ opacity: isPending ? 0.35 : 1 }}
                      >
                        {/* step indicator */}
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300"
                          style={{
                            background: isCompleted
                              ? "var(--accent)"
                              : isActive
                                ? "transparent"
                                : "transparent",
                            border: isCompleted
                              ? "none"
                              : isActive
                                ? "1.5px solid var(--accent)"
                                : "1.5px solid var(--border)",
                          }}
                        >
                          {isCompleted ? (
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="var(--bg-primary)"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : isActive ? (
                            <div
                              className="w-2.5 h-2.5 rounded-full border-2 animate-spin"
                              style={{
                                borderColor: "rgba(64,192,87,0.25)",
                                borderTopColor: "var(--accent)",
                              }}
                            />
                          ) : (
                            <span
                              className="text-[9px] font-semibold"
                              style={{ color: "var(--text-muted)" }}
                            >
                              {i + 1}
                            </span>
                          )}
                        </div>

                        {/* text */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="text-xs font-medium"
                              style={{
                                color: isCompleted
                                  ? "var(--accent)"
                                  : isActive
                                    ? "var(--text-primary)"
                                    : "var(--text-muted)",
                              }}
                            >
                              {step.label}
                            </span>
                            {isActive && (
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded-full"
                                style={{
                                  background: "rgba(64,192,87,0.12)",
                                  color: "var(--accent)",
                                }}
                              >
                                in progress
                              </span>
                            )}
                          </div>
                          {isActive && (
                            <p
                              className="text-[10px] mt-0.5 leading-relaxed"
                              style={{ color: "var(--text-muted)" }}
                            >
                              {step.sublabel}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={!canSubmit}
                className="px-6 py-2.5 rounded-[5px] text-xs font-semibold tracking-wide transition-opacity hover:opacity-85 disabled:opacity-40"
                style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
              >
                {busy ? (progress === "done" ? "Done!" : "Processing…") : "Upload Wallpaper"}
              </button>
            </div>
          </div>
        </form>

        <p className="text-xs max-w-2xl mt-12 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Content policy: uploads are automatically checked for safety. Images that violate community guidelines are
          rejected and removed from storage. By uploading, you confirm you own or have rights to distribute this work.
        </p>
      </div>
    </main>
  );
}
