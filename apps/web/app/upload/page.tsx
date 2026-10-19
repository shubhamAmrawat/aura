"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import { useToast } from "@/lib/toast";
import { getCategories } from "@/lib/api";
import {
  discardUpload,
  prepareUpload,
  publishUpload,
  sendToStorage,
  UploadError,
  type DuplicateInfo,
  type PreparedUpload,
  type PublishResult,
} from "@/lib/uploadApi";
import { DesktopPreview, PhonePreview } from "./DevicePreview";
import {
  AlignLeft, ArrowRight, Check, Clock, FileImage, Folder, House, LayoutGrid, Link as LinkIcon, LoaderCircle as LoaderCircleIcon, Lock, Maximize, Monitor, Palette,
  RectangleHorizontal, RectangleVertical, RefreshCw, Smartphone, Sparkles, Tag, Type, Upload, X,
  type LucideIcon,
} from "lucide-react";

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 25 * 1024 * 1024;
/** Shortest side — the API enforces the same. */
const MIN_SHORT_SIDE = 1080;
const MAX_TAGS = 10;

type Category = { id: string; name: string; slug: string };
type Phase = "empty" | "uploading" | "reading" | "ready" | "duplicate" | "publishing" | "done";
type View = "lock" | "home" | "desktop";

/** Which previews fit an image: portrait → phone only, landscape → desktop only, near-square → both. */
function viewsFor(w: number, h: number): { id: View; label: string; icon: IconName }[] {
  const r = w / h;
  if (r < 0.8) return [{ id: "lock", label: "Lock screen", icon: "lock" }, { id: "home", label: "Home screen", icon: "home" }];
  if (r > 1.25) return [{ id: "desktop", label: "Desktop", icon: "desktop" }];
  return [{ id: "lock", label: "Phone", icon: "phone" }, { id: "desktop", label: "Desktop", icon: "desktop" }];
}

const fmtBytes = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const resLabel = (w: number, h: number) => {
  const long = Math.max(w, h);
  return long >= 3840 ? "4K" : long >= 2560 ? "QHD" : long >= 1920 ? "Full HD" : "HD";
};
const cleanTag = (t: string) => t.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 30);

function imageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file isn’t an image we can read.")); };
    img.src = url;
  });
}

/** Icons used in the studio (lucide). */
const ICONS = {
  lock: Lock, home: LayoutGrid, phone: Smartphone, desktop: Monitor,
  title: Type, description: AlignLeft, category: Folder, tag: Tag, replace: RefreshCw,
} satisfies Record<string, LucideIcon>;
type IconName = keyof typeof ICONS;
const Icon = ({ name, size = 15 }: { name: IconName; size?: number }) => {
  const C = ICONS[name];
  return <C size={size} strokeWidth={1.9} aria-hidden="true" className="shrink-0" />;
};
/** Label row icon, a touch dimmer than the label text. */
const LabelIcon = ({ name }: { name: IconName }) => <span className="text-[#8a8a8a]"><Icon name={name} size={14} /></span>;
const Sparkle = ({ size = 14 }: { size?: number }) => <Sparkles size={size} strokeWidth={2} aria-hidden="true" />;
/** Icon at the start of an image-info pill. */
const PillIcon = ({ icon: C }: { icon: LucideIcon }) => <C size={14} strokeWidth={1.9} aria-hidden="true" className="shrink-0 text-[#8a8a8a]" />;

/** Inside a <Link>: swaps the label for a spinner while the next page loads. */
function LinkLabel({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return (
    <span className="inline-flex items-center gap-2">
      {pending && <LoaderCircleIcon size={16} strokeWidth={2.4} className="animate-spin" aria-hidden="true" />}
      {children}
    </span>
  );
}

export default function UploadPage() {
  const router = useRouter();
  const { user, loaded } = useAuth();
  const { toast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [phase, setPhase] = useState<Phase>("empty");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dims, setDims] = useState<{ width: number; height: number } | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<PreparedUpload | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateInfo | null>(null);
  const [result, setResult] = useState<PublishResult | null>(null);
  const [view, setView] = useState<View>("lock");
  const [dragging, setDragging] = useState(false);

  // details
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [extras, setExtras] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [aiFilled, setAiFilled] = useState(false);
  const [showAllCats, setShowAllCats] = useState(false);
  const touched = useRef({ title: false, description: false, category: false, tags: false });

  const fileInput = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const uploadedKey = useRef<string | null>(null);

  // Creators only (everyone else applies first)
  useEffect(() => {
    if (!loaded) return;
    if (!user) router.replace("/login?next=%2Fupload");
    else if (!user.isCreator) router.replace("/creator/apply");
  }, [loaded, user, router]);

  useEffect(() => {
    getCategories()
      .then((list) => setCategories(list.filter((c) => c.slug !== "uncategorized")))
      .catch(() => setCategories([]));
  }, []);

  // Leaving with an unpublished upload: warn, and clean it up.
  useEffect(() => {
    const unsaved = phase === "uploading" || phase === "reading" || phase === "ready";
    if (!unsaved) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [phase]);

  useEffect(() => () => { if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview); }, [preview]);

  const resetDetails = () => {
    setTitle(""); setDescription(""); setCategoryId(""); setExtras([]); setTags([]); setTagInput("");
    setAiFilled(false); setShowAllCats(false);
    touched.current = { title: false, description: false, category: false, tags: false };
  };

  /** Throw away the current image (and its upload, if it reached storage). */
  const clearImage = useCallback(() => {
    abortRef.current?.abort();
    if (uploadedKey.current) void discardUpload(uploadedKey.current);
    uploadedKey.current = null;
    setFile(null); setPreview(null); setDims(null); setProgress(0); setPrepared(null);
    setDuplicate(null); setError(null); setResult(null);
    setPhase("empty");
  }, []);

  const startOver = () => { clearImage(); resetDetails(); };

  async function takeFile(f: File | undefined | null) {
    if (!f) return;
    setError(null);
    if (!TYPES.includes(f.type)) { setError("Use a JPG, PNG or WebP image."); return; }
    if (f.size > MAX_BYTES) { setError("That file is larger than 25 MB."); return; }
    let size: { width: number; height: number };
    try { size = await imageSize(f); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t read that image."); return; }
    if (Math.min(size.width, size.height) < MIN_SHORT_SIDE) {
      setError(`This image is ${size.width} × ${size.height}. Use at least ${MIN_SHORT_SIDE} px on the short side so it looks sharp on phones.`);
      return;
    }

    clearImage();
    const abort = new AbortController();
    abortRef.current = abort;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setDims(size);
    setView(viewsFor(size.width, size.height)[0]?.id ?? "lock");
    setPhase("uploading");

    try {
      const { key, fileUrl } = await sendToStorage(f, setProgress, abort.signal);
      if (abort.signal.aborted) return;
      uploadedKey.current = key;
      setPhase("reading");
      const p = await prepareUpload({ key, fileUrl, fileType: f.type, fileSizeBytes: f.size });
      if (abort.signal.aborted) return;
      setPrepared(p);
      applySuggestions(p);
      setPhase("ready");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      uploadedKey.current = null; // the API already removed a refused file
      if (e instanceof UploadError && e.duplicate) {
        setDuplicate(e.duplicate);
        setPhase("duplicate");
        return;
      }
      setError(e instanceof Error ? e.message : "Upload failed. Try again.");
      setFile(null); setPreview(null); setDims(null);
      setPhase("empty");
    }
  }

  /** Fill in what the AI suggested — never over something the creator already typed. */
  function applySuggestions(p: PreparedUpload) {
    const s = p.suggestions;
    const t = touched.current;
    let used = false;
    if (!t.title && s.title) { setTitle(s.title); used = true; }
    if (!t.description && s.description) { setDescription(s.description); used = true; }
    if (!t.category && s.categoryId) {
      setCategoryId(s.categoryId);
      setExtras(s.extraCategoryIds.filter((id) => id !== s.categoryId).slice(0, 2));
      used = true;
    }
    if (!t.tags && s.tags.length) { setTags(s.tags.map(cleanTag).filter(Boolean).slice(0, MAX_TAGS)); used = true; }
    setAiFilled(used);
  }

  // Paste an image from the clipboard (Ctrl + V) while on the empty screen.
  useEffect(() => {
    if (phase !== "empty") return;
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
      if (item) { e.preventDefault(); void takeFile(item); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const addTag = (raw: string) => {
    const t = cleanTag(raw.replace(/,/g, ""));
    touched.current.tags = true;
    if (t && !tags.includes(t) && tags.length < MAX_TAGS) setTags([...tags, t]);
    setTagInput("");
  };

  const pickCategory = (id: string) => {
    touched.current.category = true;
    setCategoryId(id);
    setExtras((cur) => cur.filter((x) => x !== id));
  };
  const toggleExtra = (id: string) => {
    touched.current.category = true;
    setExtras((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < 2 ? [...cur, id] : cur));
  };

  const ready = phase === "ready" && !!prepared && !!file && !!dims;
  const blocker = !ready
    ? phase === "uploading" ? "Uploading…" : phase === "reading" ? "Reading your image…" : ""
    : !title.trim() ? "Add a title" : !categoryId ? "Pick a category" : "";

  async function publish() {
    if (!ready || blocker || !prepared || !file || !dims) return;
    setPhase("publishing");
    try {
      const r = await publishUpload({
        key: prepared.key, fileUrl: prepared.fileUrl, fileType: file.type, fileSizeBytes: file.size,
        width: prepared.width || dims.width, height: prepared.height || dims.height,
        title: title.trim().slice(0, 100), description: description.trim().slice(0, 500),
        categoryId, extraCategoryIds: extras, tags,
      });
      uploadedKey.current = null;
      setResult(r);
      setPhase("done");
      window.scrollTo({ top: 0 });
      if (r.moderationStatus === "approved") void fetch("/api/revalidate-feeds", { method: "POST" }).catch(() => undefined);
    } catch (e) {
      if (e instanceof UploadError && e.duplicate) {
        uploadedKey.current = null;
        setDuplicate(e.duplicate);
        setPhase("duplicate");
        return;
      }
      if (e instanceof UploadError && e.status === 422) {
        uploadedKey.current = null;
        setError(e.message);
        setFile(null); setPreview(null); setDims(null); setPrepared(null);
        setPhase("empty");
        return;
      }
      toast(e instanceof Error ? e.message : "Couldn’t publish. Try again.", "error");
      setPhase("ready");
    }
  }

  const close = () => {
    if (phase === "uploading" || phase === "reading" || phase === "ready") clearImage();
    router.push("/profile?tab=uploads");
  };

  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const suggestedIds = useMemo(() => {
    const s = prepared?.suggestions;
    const ids = [s?.categoryId, s?.alternativeId, ...(s?.extraCategoryIds ?? [])].filter((x): x is string => !!x && catName.has(x));
    if (categoryId && !ids.includes(categoryId)) ids.unshift(categoryId);
    return [...new Set(ids)];
  }, [prepared, categoryId, catName]);

  if (!loaded || !user || !user.isCreator) {
    return <main className="min-h-screen" style={{ background: "var(--bg-primary)" }} />;
  }

  // ─── finished ───
  if (phase === "done" && result) {
    const live = result.moderationStatus === "approved";
    const wide = prepared ? !prepared.isMobile : !!dims && dims.width > dims.height;
    const link = `${window.location.origin}/wallpaper/${result.wallpaper.id}`;
    return (
      <main className="relative min-h-screen flex items-center justify-center px-5 pt-24 pb-16" style={{ background: "radial-gradient(ellipse 60% 50% at 50% 35%, #14201a, var(--bg-primary) 70%)", color: "var(--text-primary)" }}>
        <header className="absolute top-0 inset-x-0 flex items-center justify-between gap-3 px-5 sm:px-10 py-4">
          <Link href="/" className="h-10 pl-3 pr-4 rounded-full text-sm font-medium inline-flex items-center gap-2 bg-white/[0.05] hover:bg-white/[0.1] transition-colors" style={{ color: "#e5e5e5" }}>
            <House size={16} strokeWidth={2} aria-hidden="true" />
            <LinkLabel>Home</LinkLabel>
          </Link>
          <Link href="/profile?tab=uploads" className="h-10 px-4 rounded-full text-sm font-medium inline-flex items-center hover:bg-white/[0.05] transition-colors" style={{ color: "var(--text-secondary)" }}>
            <LinkLabel>Your uploads</LinkLabel>
          </Link>
        </header>
        <div className="w-full max-w-[640px] flex flex-col items-center gap-5 text-center" style={{ animation: "auth-in 0.5s ease both" }}>
          {/* Same frame as the image was made for: phone for portrait, screen for landscape. */}
          <div className={`relative ${wide ? "w-[min(460px,84vw)] aspect-[16/10]" : "w-[200px] aspect-[9/16]"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={prepared?.thumbUrl ?? preview ?? ""} alt="" className={`absolute inset-0 w-full h-full object-cover ${wide ? "rounded-[12px]" : "rounded-[28px]"}`} style={{ boxShadow: `0 0 0 ${wide ? 6 : 7}px #050505, 0 0 0 ${wide ? 7 : 8}px rgba(255,255,255,0.12), 0 40px 90px rgba(0,0,0,0.55)` }} />
            <span className="absolute -right-3.5 -bottom-3.5 w-12 h-12 rounded-full flex items-center justify-center" style={{ background: live ? "var(--accent)" : "#facc15", color: "#0a0a0a", boxShadow: "0 0 0 6px var(--bg-primary)" }}>
              {live ? <Check size={22} strokeWidth={3} aria-hidden="true" /> : <Clock size={21} strokeWidth={2.4} aria-hidden="true" />}
            </span>
          </div>
          <h1 className="mt-3 text-[40px] sm:text-[48px] leading-[1.04]" style={{ fontFamily: "var(--font-serif), serif" }}>{live ? "It’s live on Aurora" : "Sent for a quick review"}</h1>
          <p className="text-[15px] leading-relaxed max-w-[460px]" style={{ color: "var(--text-secondary)" }}>
            {live
              ? <>“{result.wallpaper.title}” is now on Aurora. You’ll see its views and downloads on your profile.</>
              : result.similarTo
                ? <>It looks very similar to “{result.similarTo.title}”{result.similarTo.by ? ` by @${result.similarTo.by}` : ""}, so our team will take a look first. We’ll email you when it’s live.</>
                : <>Our safety check wasn’t sure about it, so our team will take a look first. We’ll email you when it’s live.</>}
          </p>
          <div className="flex flex-wrap justify-center gap-2.5 mt-1.5">
            {live ? (
              <Link href={`/wallpaper/${result.wallpaper.id}`} className="h-12 px-6 rounded-full text-sm font-semibold inline-flex items-center hover:opacity-90" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}><LinkLabel>View wallpaper</LinkLabel></Link>
            ) : (
              <Link href="/profile?tab=uploads" className="h-12 px-6 rounded-full text-sm font-semibold inline-flex items-center hover:opacity-90" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}><LinkLabel>See your uploads</LinkLabel></Link>
            )}
            <button type="button" onClick={startOver} className="h-12 px-6 rounded-full text-sm font-semibold border border-white/[0.14] hover:bg-white/[0.05]">Upload another</button>
            {live && (
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(link).then(() => toast("Link copied", "success"), () => toast("Couldn’t copy the link", "error"))}
                className="h-12 px-6 rounded-full text-sm font-semibold border border-white/[0.14] hover:bg-white/[0.05] inline-flex items-center gap-2"
              >
                <LinkIcon size={15} strokeWidth={2} aria-hidden="true" />
                Copy link
              </button>
            )}
          </div>
        </div>
      </main>
    );
  }

  const busy = phase === "uploading" || phase === "reading";
  const views = dims ? viewsFor(dims.width, dims.height) : [];
  const status =
    phase === "uploading" ? `Uploading ${Math.round(progress * 100)}%`
    : phase === "reading" ? "Reading your image…"
    : phase === "ready" ? "Ready to publish"
    : phase === "publishing" ? "Publishing…"
    : phase === "duplicate" ? "Already on Aurora"
    : "Add an image to start";

  return (
    <main className="min-h-screen flex flex-col" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      {/* ── top bar ── */}
      <header className="sticky top-0 z-20 flex items-center gap-4 px-5 sm:px-10 py-3.5 border-b border-white/[0.06] backdrop-blur-xl" style={{ background: "rgba(10,10,10,0.85)" }}>
        <button type="button" onClick={close} aria-label="Close" className="w-10 h-10 rounded-full flex items-center justify-center bg-white/[0.05] hover:bg-white/[0.1]" style={{ color: "#cfcfcf" }}>
          <X size={17} strokeWidth={2.2} aria-hidden="true" />
        </button>
        <div className="flex flex-col min-w-0">
          <span className="text-[15px] font-semibold">New wallpaper</span>
          <span className="text-xs truncate" style={{ color: "var(--text-muted)" }} aria-live="polite">{status}</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {blocker && phase !== "empty" && phase !== "duplicate" && <span className="hidden sm:inline text-[13px]" style={{ color: "var(--text-muted)" }}>{blocker}</span>}
          {phase !== "empty" && phase !== "duplicate" && <button
            type="button"
            onClick={() => void publish()}
            disabled={!ready || !!blocker}
            className="h-[42px] px-5 sm:px-6 rounded-full text-sm font-semibold inline-flex items-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
          >
            {phase === "publishing" ? "Publishing…" : "Publish"}
            {phase !== "publishing" && <ArrowRight size={16} strokeWidth={2.2} aria-hidden="true" />}
          </button>}
        </div>
      </header>

      <input
        ref={fileInput}
        type="file"
        accept={TYPES.join(",")}
        hidden
        onChange={(e) => { void takeFile(e.target.files?.[0]); e.target.value = ""; }}
      />

      {phase === "empty" ? (
        /* ── empty: one big drop zone ── */
        <div className="flex-1 w-full max-w-[880px] mx-auto px-5 sm:px-10 py-10 sm:py-14 flex flex-col gap-6">
          <div>
            <h1 className="text-[40px] sm:text-[52px] leading-[1.03]" style={{ fontFamily: "var(--font-serif), serif" }}>Share a wallpaper</h1>
            <p className="mt-2 text-[15px]" style={{ color: "var(--text-secondary)" }}>One at a time — we’ll fill in the details from your image, you check them and publish.</p>
          </div>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); void takeFile(e.dataTransfer.files[0]); }}
            className="w-full min-h-[380px] rounded-[28px] flex flex-col items-center justify-center gap-4 px-6 text-center transition-[background,border-color,transform] duration-200 hover:bg-white/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            style={{
              border: `1.5px dashed ${dragging ? "var(--accent)" : "rgba(255,255,255,0.16)"}`,
              background: dragging ? "var(--accent-muted)" : "rgba(255,255,255,0.015)",
              transform: dragging ? "scale(1.01)" : undefined,
            }}
          >
            <span className="w-[60px] h-[60px] rounded-[18px] flex items-center justify-center" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>
              <Upload size={26} strokeWidth={2} aria-hidden="true" />
            </span>
            <span className="text-lg font-medium">{dragging ? "Drop to upload" : "Drop your wallpaper here, or click to choose"}</span>
            <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>JPG, PNG or WebP · at least {MIN_SHORT_SIDE} px on the short side · up to 25 MB · you can also paste with Ctrl + V</span>
          </button>
          {error && (
            <p role="alert" className="rounded-2xl px-5 py-4 text-sm leading-relaxed" style={{ background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.25)", color: "#fca5a5" }}>{error}</p>
          )}
          <div className="grid sm:grid-cols-3 gap-3 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            {[
              ["Your own work", "Made or shot by you — reposts of other people’s wallpapers are blocked."],
              ["Sharp and made for screens", "High resolution, works behind app icons and a clock."],
              ["Small signatures are fine", "A subtle watermark is OK if it doesn’t cover the image."],
            ].map(([t, s]) => (
              <div key={t} className="rounded-2xl px-4 py-3.5" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="font-medium" style={{ color: "var(--text-primary)" }}>{t}</p>
                <p className="mt-1 leading-normal">{s}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ── studio: preview + details ── */
        <div className="flex-1 w-full max-w-[1280px] mx-auto px-5 sm:px-10 pt-6 sm:pt-8 pb-16 flex flex-wrap gap-8 lg:gap-10 items-start">
          <section aria-label="Preview" className="flex-[1_1_520px] min-w-0 flex flex-col gap-4 lg:sticky lg:top-24">
            <div className="flex items-center gap-3 min-h-[42px]">
              {phase !== "duplicate" && views.length > 1 && (
                <div role="group" aria-label="Preview" className="flex gap-1 p-1 rounded-full border border-white/[0.08] bg-[#111]">
                  {views.map((v) => (
                    <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => setView(v.id)} className="h-[34px] px-3 sm:px-3.5 rounded-full text-[13px] font-medium whitespace-nowrap inline-flex items-center gap-1.5 transition-colors" style={view === v.id ? { background: "#f5f0eb", color: "#0a0a0a" } : { color: "#cfcfcf" }}><Icon name={v.icon} size={14} />{v.label}</button>
                  ))}
                </div>
              )}
              {phase !== "duplicate" && views.length === 1 && <span className="text-[13px] inline-flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}><Icon name="desktop" size={14} />Desktop preview</span>}
              {phase !== "publishing" && phase !== "duplicate" && (
                <button type="button" onClick={() => fileInput.current?.click()} aria-label="Replace image" title="Replace image" className="ml-auto h-[34px] w-[34px] sm:w-auto justify-center sm:px-3.5 rounded-full text-[13px] font-medium whitespace-nowrap inline-flex items-center gap-1.5 border border-white/[0.12] hover:bg-white/[0.08]" style={{ color: "#e5e5e5" }}>
                  <Icon name="replace" size={14} /><span className="hidden sm:inline">Replace image</span>
                </button>
              )}
            </div>
            <div className={`relative ${view === "desktop" ? "h-[300px] sm:h-[460px]" : "h-[560px] sm:h-[640px]"} rounded-3xl border border-white/[0.06] overflow-hidden flex items-center justify-center`} style={{ background: "radial-gradient(ellipse 70% 60% at 50% 40%, #17201a, #0f0f0f 70%)" }}>
              {preview && (view === "desktop" ? <DesktopPreview src={preview} dim={busy || phase === "duplicate"} /> : <PhonePreview src={preview} screen={view} dim={busy || phase === "duplicate"} />)}

              {busy && (
                <div className="absolute inset-x-0 bottom-0 p-5 flex flex-col items-center gap-3" role="status">
                  <div className="w-full max-w-[320px] h-1.5 rounded-full overflow-hidden bg-white/[0.12]">
                    <div
                      className={`h-full rounded-full transition-[width] duration-200 ${phase === "reading" ? "w-[35%] animate-[upload-bar-indeterminate_1.1s_ease-in-out_infinite]" : ""}`}
                      style={{ background: "var(--accent)", width: phase === "uploading" ? `${Math.round(progress * 100)}%` : undefined }}
                    />
                  </div>
                  <span className="text-[13px] font-medium text-white/85">
                    {phase === "uploading" ? `Uploading · ${Math.round(progress * 100)}%` : "Checking it and drafting the details…"}
                  </span>
                </div>
              )}

              {phase === "duplicate" && duplicate && (
                <div className="absolute inset-0 flex items-center justify-center p-5" role="alert">
                  <div className="w-full max-w-[420px] rounded-3xl p-6 flex flex-col items-center gap-4 text-center border border-white/[0.1]" style={{ background: "rgba(14,14,14,0.92)", backdropFilter: "blur(10px)", animation: "auth-in 0.35s ease both" }}>
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {preview && <img src={preview} alt="Your image" className="w-[72px] h-[120px] object-cover rounded-xl" />}
                      <span className="text-xl" style={{ color: "var(--text-muted)" }} aria-hidden="true">=</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {duplicate.thumbUrl && <img src={duplicate.thumbUrl} alt={`“${duplicate.title}” on Aurora`} className="w-[72px] h-[120px] object-cover rounded-xl" />}
                    </div>
                    <h2 className="text-[26px] leading-tight" style={{ fontFamily: "var(--font-serif), serif" }}>
                      {duplicate.yours ? "You’ve already uploaded this" : "This wallpaper is already on Aurora"}
                    </h2>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      It matches <Link href={`/wallpaper/${duplicate.id}`} className="underline underline-offset-4" style={{ color: "var(--text-primary)" }}>“{duplicate.title}”</Link>
                      {duplicate.by && !duplicate.yours ? <> by @{duplicate.by}</> : null}. Each picture can only be on Aurora once — share something new of your own.
                    </p>
                    <button type="button" onClick={() => { clearImage(); fileInput.current?.click(); }} className="h-11 px-6 rounded-full text-sm font-semibold hover:opacity-90" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>Choose another image</button>
                  </div>
                </div>
              )}
            </div>

            {prepared && phase !== "duplicate" && (
              <div className="flex flex-wrap gap-2 text-[13px]" style={{ color: "#d4d4d4" }}>
                <span className="h-[30px] px-3 rounded-full inline-flex items-center gap-1.5 bg-[#141414] border border-white/[0.08]"><PillIcon icon={Maximize} />{prepared.width} × {prepared.height} · {resLabel(prepared.width, prepared.height)}</span>
                <span className="h-[30px] px-3 rounded-full inline-flex items-center gap-1.5 bg-[#141414] border border-white/[0.08]"><PillIcon icon={prepared.isMobile ? RectangleVertical : RectangleHorizontal} />{prepared.isMobile ? "Portrait · best on phones" : "Landscape · best on desktops"}</span>
                <span className="h-[30px] px-3 rounded-full inline-flex items-center gap-1.5 bg-[#141414] border border-white/[0.08]"><PillIcon icon={FileImage} />{file?.type.split("/")[1]?.toUpperCase()} · {fmtBytes(prepared.fileSizeBytes)}</span>
                {prepared.palette.length > 0 && (
                  <span className="h-[30px] px-3 rounded-full inline-flex items-center gap-1.5 bg-[#141414] border border-white/[0.08]">
                    <PillIcon icon={Palette} />Colours
                    <span className="inline-flex">
                      {prepared.palette.slice(0, 4).map((c, i) => <span key={c + i} className="w-3.5 h-3.5 rounded-full border border-black/40" style={{ background: c, marginLeft: i ? -4 : 0 }} />)}
                    </span>
                  </span>
                )}
              </div>
            )}
          </section>

          {/* ── details ── */}
          <section aria-label="Details" className="flex-[1_1_380px] max-w-[520px] flex flex-col gap-5" style={{ opacity: phase === "duplicate" ? 0.4 : 1, pointerEvents: phase === "duplicate" ? "none" : undefined }}>
            {phase === "reading" || phase === "uploading" ? (
              <div className="rounded-[14px] px-3.5 py-3 flex gap-2.5 items-center text-[13px]" style={{ background: "rgba(139,124,246,0.08)", border: "1px solid rgba(139,124,246,0.25)", color: "#d6d0ff" }}>
                <span className="text-[#b4a9ff] animate-pulse"><Sparkle size={16} /></span>
                We’re reading your image and drafting a title, description, tags and category…
              </div>
            ) : aiFilled ? (
              <div className="rounded-[14px] px-3.5 py-3 flex gap-2.5 items-start text-[13px] leading-normal" style={{ background: "rgba(139,124,246,0.08)", border: "1px solid rgba(139,124,246,0.25)", color: "#d6d0ff" }}>
                <span className="text-[#b4a9ff] mt-0.5"><Sparkle size={16} /></span>
                We filled these in from your image. Check them and change anything you like.
              </div>
            ) : null}

            {prepared?.similarTo && (
              <div className="rounded-[14px] px-3.5 py-3 flex gap-3 items-center text-[13px] leading-normal" style={{ background: "rgba(250,204,21,0.07)", border: "1px solid rgba(250,204,21,0.25)", color: "#f1dc8a" }} role="status">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {prepared.similarTo.thumbUrl && <img src={prepared.similarTo.thumbUrl} alt="" className="w-9 h-14 rounded-md object-cover shrink-0" />}
                <span>Looks very similar to “{prepared.similarTo.title}”{prepared.similarTo.by ? ` by @${prepared.similarTo.by}` : ""}. You can still publish — it’ll go to a quick review first.</span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <div className="flex justify-between gap-3">
                <label htmlFor="up-title" className="text-[13px] flex items-center gap-2" style={{ color: "#c9c9c9" }}><LabelIcon name="title" />Title {aiFilled && !touched.current.title && title && <span className="h-[18px] px-1.5 rounded-full text-[10.5px] font-medium inline-flex items-center gap-1 text-[#c4bbff] bg-[rgba(139,124,246,0.14)]"><Sparkle size={9} />AI</span>}</label>
                <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>{title.length}/100</span>
              </div>
              <input
                id="up-title"
                value={title}
                maxLength={100}
                disabled={busy}
                onChange={(e) => { touched.current.title = true; setTitle(e.target.value); }}
                placeholder={busy ? "Drafting…" : "A short, descriptive title"}
                className="w-full h-12 px-3.5 rounded-xl text-[15px] bg-[#151515] border border-white/[0.08] outline-none transition-[border-color,box-shadow] placeholder:text-[#6f6f6f] focus:border-[color:var(--accent)] focus:shadow-[0_0_0_4px_var(--accent-muted)] disabled:opacity-60"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between gap-3">
                <label htmlFor="up-desc" className="text-[13px] flex items-center gap-2" style={{ color: "#c9c9c9" }}><LabelIcon name="description" />Description <span style={{ color: "var(--text-muted)" }}>· optional</span></label>
                <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>{description.length}/500</span>
              </div>
              <textarea
                id="up-desc"
                rows={4}
                value={description}
                maxLength={500}
                disabled={busy}
                onChange={(e) => { touched.current.description = true; setDescription(e.target.value); }}
                placeholder={busy ? "Drafting…" : "What’s in it, the mood, the story behind it"}
                className="w-full px-3.5 py-3 rounded-xl text-[15px] leading-relaxed bg-[#151515] border border-white/[0.08] outline-none resize-y transition-[border-color,box-shadow] placeholder:text-[#6f6f6f] focus:border-[color:var(--accent)] focus:shadow-[0_0_0_4px_var(--accent-muted)] disabled:opacity-60"
              />
            </div>

            <div className="flex flex-col gap-2.5">
              <span className="text-[13px] flex items-center gap-2" style={{ color: "#c9c9c9" }} id="lbl-cat"><LabelIcon name="category" />Category</span>
              <div role="radiogroup" aria-labelledby="lbl-cat" className="flex flex-wrap gap-2">
                {(showAllCats ? categories.map((c) => c.id) : suggestedIds).map((id) => {
                  const on = categoryId === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={busy}
                      onClick={() => pickCategory(id)}
                      className="h-[34px] px-3 rounded-full text-[13px] font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      style={on ? { border: "1px solid var(--accent)", background: "var(--accent-muted)", color: "var(--text-primary)" } : { border: "1px solid rgba(255,255,255,0.12)", color: "#cfcfcf" }}
                    >
                      {catName.get(id)}
                      {on && id === prepared?.suggestions.categoryId && <span className="text-[11px] opacity-75">AI pick</span>}
                    </button>
                  );
                })}
                <button type="button" disabled={busy} onClick={() => setShowAllCats((v) => !v)} className="h-[34px] px-3 rounded-full text-[13px] font-medium disabled:opacity-50" style={{ border: "1px dashed rgba(255,255,255,0.18)", color: "#cfcfcf" }}>
                  {showAllCats ? "Fewer" : suggestedIds.length ? "All categories…" : "Choose a category…"}
                </button>
              </div>
              {categoryId && (
                <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  <span>Also show in <span className="opacity-70">(up to 2)</span>:</span>
                  {suggestedIds.filter((id) => id !== categoryId).concat(extras.filter((id) => !suggestedIds.includes(id))).map((id) => {
                    const on = extras.includes(id);
                    return (
                      <button key={id} type="button" aria-pressed={on} onClick={() => toggleExtra(id)} disabled={!on && extras.length >= 2} className="h-7 px-2.5 rounded-full text-xs transition-colors disabled:opacity-40" style={on ? { background: "rgba(255,255,255,0.1)", color: "var(--text-primary)" } : { border: "1px solid rgba(255,255,255,0.1)" }}>
                        {on ? "✓ " : "+ "}{catName.get(id)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[13px] flex items-center gap-2" style={{ color: "#c9c9c9" }}><LabelIcon name="tag" />Tags <span style={{ color: "var(--text-muted)" }}>· {tags.length}/{MAX_TAGS}</span></span>
              <div className="min-h-12 p-1.5 rounded-xl bg-[#151515] border border-white/[0.08] flex flex-wrap gap-1.5 items-center focus-within:border-[color:var(--accent)]">
                {tags.map((t) => (
                  <span key={t} className="h-[30px] pl-2.5 pr-1 rounded-lg text-[13px] inline-flex items-center gap-1 bg-[#222]">
                    {t}
                    <button type="button" onClick={() => { touched.current.tags = true; setTags(tags.filter((x) => x !== t)); }} aria-label={`Remove ${t}`} className="w-[22px] h-[22px] rounded-md flex items-center justify-center hover:bg-white/[0.08]" style={{ color: "#9a9a9a" }}>
                      <X size={11} strokeWidth={3} aria-hidden="true" />
                    </button>
                  </span>
                ))}
                {tags.length < MAX_TAGS && (
                  <input
                    aria-label="Add a tag"
                    value={tagInput}
                    disabled={busy}
                    onChange={(e) => (e.target.value.endsWith(",") ? addTag(e.target.value) : setTagInput(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); }
                      else if (e.key === "Backspace" && !tagInput && tags.length) { touched.current.tags = true; setTags(tags.slice(0, -1)); }
                    }}
                    onBlur={() => tagInput.trim() && addTag(tagInput)}
                    placeholder={tags.length ? "Add tag…" : "Type a tag and press Enter"}
                    className="flex-1 min-w-[110px] h-[30px] px-1.5 bg-transparent outline-none text-sm placeholder:text-[#6f6f6f]"
                  />
                )}
              </div>
            </div>

            <ul className="pt-4 flex flex-col gap-2.5 text-[13px] border-t border-white/[0.06]" aria-label="Checks">
              <li className="flex items-center gap-2.5" style={{ color: prepared ? "#c9c9c9" : "var(--text-muted)" }}>
                <span style={{ color: prepared ? "var(--accent)" : "var(--text-muted)" }}><Check size={16} strokeWidth={2.6} aria-hidden="true" /></span>
                {prepared ? `${prepared.width} × ${prepared.height} — sharp enough for any screen` : dims ? `${dims.width} × ${dims.height}` : "Resolution"}
              </li>
              <li className="flex items-center gap-2.5" style={{ color: prepared ? "#c9c9c9" : "var(--text-muted)" }}>
                {prepared ? <span style={{ color: prepared.similarTo ? "#facc15" : "var(--accent)" }}><Check size={16} strokeWidth={2.6} aria-hidden="true" /></span> : <span className="w-4 flex justify-center"><span className="w-1.5 h-1.5 rounded-full bg-[#6f6f6f] animate-pulse" /></span>}
                {prepared ? (prepared.similarTo ? "Similar wallpaper found — goes to review" : "Not a copy of anything on Aurora") : "Checking it’s not already on Aurora…"}
              </li>
              <li className="flex items-center gap-2.5" style={{ color: "var(--text-muted)" }}>
                <span className="w-4 flex justify-center"><span className="w-1.5 h-1.5 rounded-full bg-[#6f6f6f]" /></span>
                By publishing you confirm it’s your own work.
              </li>
            </ul>
          </section>
        </div>
      )}
    </main>
  );
}
