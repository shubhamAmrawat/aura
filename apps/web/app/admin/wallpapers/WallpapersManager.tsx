"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  bulkUpdateWallpapers,
  getCategoryOptions,
  listAdminWallpapers,
  type AdminWallpaper,
  type AdminWallpaperDetail,
  type CategoryOption,
  type WallpaperBulkAction,
  type WallpaperFilters,
  RESOLUTIONS,
  resolutionOf,
  type Resolution,
} from "@/lib/adminApi";
import { useToast } from "@/lib/toast";
import { ConfirmDialog, Modal, StatusBadge, inputStyle } from "../_components/ui";
import EditDrawer from "./EditDrawer";
import WallpaperLightbox, { type LightboxWallpaper } from "../_components/WallpaperLightbox";
import { MonitorIcon, SearchIcon, SmartphoneIcon } from "lucide-react";

const PAGE = 50;
const fmt = (n: number) => new Intl.NumberFormat("en-IN").format(n);
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "2-digit" });

const FLAG_KEYS = [
  { key: "premium", label: "Premium" },
  { key: "ai", label: "AI" },
] as const;
type FlagKey = (typeof FLAG_KEYS)[number]["key"];

const SORTS: { value: NonNullable<WallpaperFilters["sort"]>; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "downloads", label: "Most downloaded" },
  { value: "likes", label: "Most liked" },
  { value: "views", label: "Most viewed" },
  { value: "trending", label: "Trending" },
  { value: "title", label: "Title A–Z" },
];

type TagModal = { action: "addTags" | "removeTags" } | null;

export default function WallpapersManager() {
  const pathname = usePathname();
  const params = useSearchParams();
  const { toast } = useToast();

  // Filters live in the URL so refresh/back keep them
  const filters: WallpaperFilters = useMemo(() => ({
    q: params.get("q") ?? undefined,
    status: (params.get("status") as WallpaperFilters["status"]) ?? "all",
    categoryId: params.get("categoryId") ?? undefined,
    uploader: params.get("uploader") ?? undefined,
    premium: params.get("premium") === "true" ? "true" : undefined,
    mobile: (params.get("mobile") as "true" | "false") ?? undefined,
    ai: params.get("ai") === "true" ? "true" : undefined,
    resolution: (params.get("resolution") as Resolution) ?? undefined,
    sort: (params.get("sort") as WallpaperFilters["sort"]) ?? "newest",
    offset: Number(params.get("offset") ?? 0) || 0,
    limit: PAGE,
  }), [params]);

  const setFilter = useCallback((patch: Record<string, string | undefined>, keepOffset = false) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "" || (k === "status" && v === "all") || (k === "sort" && v === "newest")) next.delete(k);
      else next.set(k, v);
    }
    if (!keepOffset) next.delete("offset");
    const qs = next.toString();
    // Native replaceState: Next syncs useSearchParams with it, and no server round-trip is needed
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  }, [params, pathname]);

  const [items, setItems] = useState<AdminWallpaper[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [preview, setPreview] = useState<LightboxWallpaper | null>(null);
  const [search, setSearch] = useState(filters.q ?? "");
  const [uploader, setUploader] = useState(filters.uploader ?? "");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [tagModal, setTagModal] = useState<TagModal>(null);
  const [tagInput, setTagInput] = useState("");
  const [bulkCategory, setBulkCategory] = useState("");
  const reqId = useRef(0);

  useEffect(() => { getCategoryOptions().then(setCategories).catch(() => {}); }, []);

  const load = useCallback(async () => {
    const my = ++reqId.current;
    setLoading(true);
    setError("");
    try {
      const page = await listAdminWallpapers(filters);
      if (my !== reqId.current) return;
      setItems(page.data);
      setTotal(page.total);
    } catch (e) {
      if (my === reqId.current) setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (my === reqId.current) setLoading(false);
    }
  }, [filters]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setSelected(new Set()); }, [filters]);

  // Debounced text filters
  useEffect(() => {
    if (search === (filters.q ?? "")) return;
    const t = setTimeout(() => setFilter({ q: search.trim() || undefined }), 350);
    return () => clearTimeout(t);
  }, [search, filters.q, setFilter]);
  useEffect(() => {
    if (uploader === (filters.uploader ?? "")) return;
    const t = setTimeout(() => setFilter({ uploader: uploader.trim() || undefined }), 350);
    return () => clearTimeout(t);
  }, [uploader, filters.uploader, setFilter]);

  /** Flag chips are simple on/off: on = only wallpapers with that flag. */
  const toggleFlag = (key: FlagKey) => setFilter({ [key]: filters[key] === "true" ? undefined : "true" });

  const offset = filters.offset ?? 0;
  const allSelected = items.length > 0 && items.every((w) => selected.has(w.id));
  const selectedIds = [...selected];
  // Bulk bar only offers actions that would change something for the selection
  const selectedItems = items.filter((w) => selected.has(w.id));
  const anyUnfeatured = selectedItems.some((w) => !w.isFeatured);
  const anyFeatured = selectedItems.some((w) => w.isFeatured);
  const activeFilterCount = [filters.q, filters.categoryId, filters.uploader, filters.premium, filters.mobile, filters.ai, filters.resolution].filter(Boolean).length + (filters.status !== "all" ? 1 : 0);

  const toggle = (id: string) => setSelected((prev) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const runBulk = async (action: WallpaperBulkAction, opts: { categoryId?: string | null; tags?: string[] } = {}) => {
    if (!selectedIds.length) return;
    setBulkBusy(true);
    try {
      const res = await bulkUpdateWallpapers(selectedIds, action, opts);
      toast(`${res.succeeded} updated${res.failed ? ` · ${res.failed} failed` : ""}`, res.failed ? "error" : "success");
      setSelected(new Set());
      setConfirmBulkDelete(false);
      setTagModal(null);
      setTagInput("");
      setBulkCategory("");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Bulk update failed", "error");
    } finally {
      setBulkBusy(false);
    }
  };

  const onChanged = (d: AdminWallpaperDetail) =>
    setItems((prev) => prev.map((w) => (w.id === d.id ? { ...w, ...d } : w)));
  const onDeleted = (id: string) => {
    setEditing(null);
    setItems((prev) => prev.filter((w) => w.id !== id));
    setTotal((t) => Math.max(0, t - 1));
  };

  return (
    <div className="pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Wallpapers</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {fmt(total)} {activeFilterCount ? "matching" : "in total"} · click a row to edit
          </p>
        </div>
        {activeFilterCount > 0 && (
          <button onClick={() => { setSearch(""); setUploader(""); window.history.replaceState(null, "", pathname); }} className="text-xs px-3 py-1.5 rounded-lg hover:bg-white/5" style={{ color: "var(--text-secondary)", border: "1px solid var(--border-hover)" }}>
            Clear filters ({activeFilterCount})
          </button>
        )}
      </div>

      {/* Filters — one row, scopes the table */}
      <div className="flex flex-wrap items-center gap-2 mt-5">
        <div className="relative flex-1 min-w-[180px] max-w-md">
          <SearchIcon size={14} strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2" stroke="var(--text-muted)" aria-hidden="true" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, tags or paste an id" className="w-full rounded-lg pl-9 pr-3 py-2 text-sm" style={inputStyle} />
        </div>
        <input value={uploader} onChange={(e) => setUploader(e.target.value)} placeholder="Uploader" className="w-32 rounded-lg px-3 py-2 text-sm" style={inputStyle} />
        <select value={filters.status} onChange={(e) => setFilter({ status: e.target.value })} className="rounded-lg px-3 py-2 text-sm" style={inputStyle} aria-label="Status">
          <option value="all">All statuses</option>
          <option value="approved">Live</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
          <option value="hidden">Hidden (uploader disabled)</option>
        </select>
        <select value={filters.categoryId ?? ""} onChange={(e) => setFilter({ categoryId: e.target.value || undefined })} className="rounded-lg px-3 py-2 text-sm max-w-[180px]" style={inputStyle} aria-label="Category">
          <option value="">All categories</option>
          <option value="none">No category</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filters.resolution ?? ""} onChange={(e) => setFilter({ resolution: e.target.value || undefined })} className="rounded-lg px-3 py-2 text-sm w-[150px]" style={inputStyle} aria-label="Resolution" title="Resolution by the image's longer edge">
          <option value="">Any resolution</option>
          {RESOLUTIONS.map((r) => <option key={r.value} value={r.value} title={r.hint}>{r.label} ({r.hint})</option>)}
        </select>
        {FLAG_KEYS.map(({ key, label }) => {
          const on = filters[key] === "true";
          return (
            <button
              key={key}
              onClick={() => toggleFlag(key)}
              aria-pressed={on}
              className="text-xs px-2.5 py-2 rounded-lg transition-colors"
              style={{
                border: `1px solid ${on ? "rgba(129,238,78,0.5)" : "var(--border-hover)"}`,
                background: on ? "rgba(129,238,78,0.10)" : "transparent",
                color: on ? "var(--accent)" : "var(--text-secondary)",
              }}
            >
              {on && "✓ "}{label}
            </button>
          );
        })}
        <DeviceSlider
          value={filters.mobile === "true" ? "mobile" : filters.mobile === "false" ? "desktop" : "all"}
          onChange={(v) => setFilter({ mobile: v === "mobile" ? "true" : v === "desktop" ? "false" : undefined })}
        />
        <select value={filters.sort} onChange={(e) => setFilter({ sort: e.target.value })} className="rounded-lg px-3 py-2 text-sm ml-auto" style={inputStyle} aria-label="Sort">
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {error && (
        <p className="mt-4 text-sm px-4 py-3 rounded-lg" style={{ color: "#ef4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>{error}</p>
      )}

      {/* Table */}
      <div className="mt-4 rounded-xl overflow-x-auto" style={{ border: "1px solid var(--border)", background: "var(--bg-secondary)", opacity: loading && items.length ? 0.6 : 1 }}>
        <table className="w-full text-sm min-w-[980px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
              <th className="pl-4 pr-2 py-3 w-8">
                <input type="checkbox" aria-label="Select all on this page" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(items.map((w) => w.id)))} className="accent-[var(--accent)]" />
              </th>
              <th className="px-2 py-3">Wallpaper</th>
              <th className="px-2 py-3">Status</th>
              <th className="px-2 py-3">Category</th>
              <th className="px-2 py-3">Uploader</th>
              <th className="px-2 py-3">Flags</th>
              <th className="px-2 py-3 text-right">Downloads</th>
              <th className="px-2 py-3 text-right">Likes</th>
              <th className="px-2 py-3 text-right">Views</th>
              <th className="px-2 pr-4 py-3 text-right">Added</th>
            </tr>
          </thead>
          <tbody>
            {items.map((w) => {
              const sel = selected.has(w.id);
              return (
                <tr
                  key={w.id}
                  onClick={() => setEditing(w.id)}
                  className="cursor-pointer transition-colors hover:bg-white/[0.03]"
                  style={{ borderTop: "1px solid var(--border)", background: sel ? "rgba(129,238,78,0.05)" : undefined }}
                >
                  <td className="pl-4 pr-2 py-2" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" aria-label={`Select ${w.title}`} checked={sel} onChange={() => toggle(w.id)} className="accent-[var(--accent)]" />
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={w.thumbUrl ?? w.fileUrl}
                        alt=""
                        loading="lazy"
                        onClick={(e) => { e.stopPropagation(); setPreview(w); }}
                        className="w-12 h-12 rounded object-contain shrink-0 cursor-zoom-in transition-transform hover:scale-105"
                        style={{ background: w.dominantColor }}
                        title="View full size"
                      />
                      <div className="min-w-0">
                        <p className="truncate max-w-[320px]" style={{ color: "var(--text-primary)" }} title={w.title}>{w.title}</p>
                        <p className="text-[11px] truncate max-w-[320px]" style={{ color: "var(--text-muted)" }}>
                          {w.tags.length ? w.tags.join(", ") : "no tags"} · {w.width}×{w.height} · {resolutionOf(w.width, w.height).label}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2"><StatusBadge status={w.status} /></td>
                  <td className="px-2 py-2 text-xs" style={{ color: w.category ? "var(--text-secondary)" : "var(--text-muted)" }}>{w.category?.name ?? "—"}</td>
                  <td className="px-2 py-2 text-xs" style={{ color: w.uploader ? "var(--text-secondary)" : "var(--text-muted)" }}>{w.uploader ? `@${w.uploader.username}` : "seeded"}</td>
                  <td className="px-2 py-2">
                    <div className="flex gap-1">
                      {w.isFeatured && <Flag label="Featured" short="F" />}
                      {w.isPremium && <Flag label="Premium" short="P" />}
                      {w.isMobile ? <Flag label="Mobile (portrait)" short="Mobile" /> : <Flag label="Desktop (landscape)" short="Desktop" />}
                      {w.isAiGenerated && <Flag label="AI-generated" short="AI" />}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums" style={{ color: "var(--text-secondary)" }}>{fmt(w.downloadCount)}</td>
                  <td className="px-2 py-2 text-right tabular-nums" style={{ color: "var(--text-secondary)" }}>{fmt(w.likeCount)}</td>
                  <td className="px-2 py-2 text-right tabular-nums" style={{ color: "var(--text-secondary)" }}>{fmt(w.viewCount)}</td>
                  <td className="px-2 pr-4 py-2 text-right text-xs whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{fmtDate(w.createdAt)}</td>
                </tr>
              );
            })}
            {loading && !items.length && Array.from({ length: 8 }).map((_, i) => (
              <tr key={`s${i}`} style={{ borderTop: "1px solid var(--border)" }}>
                <td colSpan={10} className="px-4 py-3"><div className="h-10 rounded animate-pulse" style={{ background: "var(--bg-elevated)" }} /></td>
              </tr>
            ))}
            {!loading && !items.length && (
              <tr><td colSpan={10} className="px-4 py-14 text-center text-sm" style={{ color: "var(--text-muted)" }}>No wallpapers match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
          <span className="tabular-nums">{fmt(offset + 1)}–{fmt(Math.min(offset + items.length, total))} of {fmt(total)}</span>
          <div className="flex gap-2">
            <button disabled={offset === 0 || loading} onClick={() => setFilter({ offset: String(Math.max(0, offset - PAGE)) }, true)} className="px-3 py-1.5 rounded-lg disabled:opacity-30 hover:bg-white/5" style={{ border: "1px solid var(--border-hover)", color: "var(--text-secondary)" }}>← Previous</button>
            <button disabled={offset + PAGE >= total || loading} onClick={() => setFilter({ offset: String(offset + PAGE) }, true)} className="px-3 py-1.5 rounded-lg disabled:opacity-30 hover:bg-white/5" style={{ border: "1px solid var(--border-hover)", color: "var(--text-secondary)" }}>Next →</button>
          </div>
        </div>
      )}

      {/* Bulk bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-4 left-0 right-0 md:left-60 z-30 flex justify-center px-4 pointer-events-none">
        <div className="pointer-events-auto flex flex-wrap lg:flex-nowrap items-center gap-2 px-4 py-3 rounded-xl whitespace-nowrap" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-hover)", boxShadow: "0 16px 48px rgba(0,0,0,0.5)" }}>
          <span className="text-sm tabular-nums mr-1" style={{ color: "var(--text-primary)" }}>{selectedIds.length} selected</span>
          {anyUnfeatured && <BulkBtn disabled={bulkBusy} onClick={() => runBulk("feature")}>Feature</BulkBtn>}
          {anyFeatured && <BulkBtn disabled={bulkBusy} onClick={() => runBulk("unfeature")}>Unfeature</BulkBtn>}
          <select
            disabled={bulkBusy}
            value={bulkCategory}
            onChange={(e) => {
              const v = e.target.value;
              setBulkCategory(v);
              if (v) void runBulk("setCategory", { categoryId: v === "none" ? null : v });
            }}
            className="text-xs rounded-lg px-2 py-1.5"
            style={inputStyle}
            aria-label="Move to category"
          >
            <option value="">Move to category…</option>
            <option value="none">No category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <BulkBtn disabled={bulkBusy} onClick={() => setTagModal({ action: "addTags" })}>Add tags</BulkBtn>
          <BulkBtn disabled={bulkBusy} onClick={() => setTagModal({ action: "removeTags" })}>Remove tags</BulkBtn>
          <BulkBtn disabled={bulkBusy} danger onClick={() => setConfirmBulkDelete(true)}>Delete</BulkBtn>
          <button onClick={() => setSelected(new Set())} className="text-xs px-2 py-1.5" style={{ color: "var(--text-muted)" }}>Clear</button>
        </div>
        </div>
      )}

      {editing && (
        <EditDrawer id={editing} categories={categories} onClose={() => setEditing(null)} onChanged={onChanged} onDeleted={onDeleted} />
      )}

      {preview && <WallpaperLightbox wallpaper={preview} onClose={() => setPreview(null)} />}

      {confirmBulkDelete && (
        <ConfirmDialog
          title={`Delete ${selectedIds.length} wallpaper${selectedIds.length === 1 ? "" : "s"}?`}
          body="They're removed for good, with their likes, downloads and collection entries. This can't be undone."
          confirmLabel="Delete"
          danger
          busy={bulkBusy}
          onCancel={() => setConfirmBulkDelete(false)}
          onConfirm={() => runBulk("delete")}
        />
      )}

      {tagModal && (
        <Modal onClose={() => setTagModal(null)} busy={bulkBusy}>
          <div>
            <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{tagModal.action === "addTags" ? "Add tags" : "Remove tags"}</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
              {tagModal.action === "addTags" ? "Added" : "Removed"} on {selectedIds.length} wallpaper{selectedIds.length === 1 ? "" : "s"}. Separate tags with commas.
            </p>
          </div>
          <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="e.g. sunset, beach" autoFocus className="rounded-lg px-3 py-2 text-sm" style={inputStyle}
            onKeyDown={(e) => { if (e.key === "Enter") document.getElementById("tag-apply")?.click(); }} />
          <div className="flex justify-end gap-2">
            <button onClick={() => setTagModal(null)} className="text-sm px-3 py-2 rounded-lg" style={{ color: "var(--text-secondary)" }}>Cancel</button>
            <button
              id="tag-apply"
              disabled={bulkBusy || !tagInput.split(",").some((t) => t.trim())}
              onClick={() => runBulk(tagModal.action, { tags: tagInput.split(",").map((t) => t.trim()).filter(Boolean) })}
              className="text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-40"
              style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
            >
              {bulkBusy ? "Working…" : "Apply"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

type Device = "mobile" | "all" | "desktop";

/** Three-position sliding switch: Mobile ← All → Desktop. */
function DeviceSlider({ value, onChange }: { value: Device; onChange: (v: Device) => void }) {
  const options: { v: Device; label: string; icon: React.ReactNode }[] = [
    { v: "mobile", label: "Mobile", icon: <SmartphoneIcon size={12} strokeWidth={2} aria-hidden="true" /> },
    { v: "all", label: "All", icon: null },
    { v: "desktop", label: "Desktop", icon: <MonitorIcon size={12} strokeWidth={2} aria-hidden="true" /> },
  ];
  const idx = options.findIndex((o) => o.v === value);
  return (
    <div role="radiogroup" aria-label="Device" className="relative grid grid-cols-3 rounded-lg p-0.5 text-xs" style={{ background: "var(--bg-primary)", border: "1px solid var(--border-hover)", width: 228 }}>
      <span
        aria-hidden
        className="absolute top-0.5 bottom-0.5 rounded-md transition-transform duration-200 ease-out"
        style={{
          width: "calc((100% - 4px) / 3)",
          left: 2,
          transform: `translateX(${idx * 100}%)`,
          background: value === "all" ? "var(--bg-elevated)" : "rgba(129,238,78,0.16)",
          border: value === "all" ? "1px solid var(--border-hover)" : "1px solid rgba(129,238,78,0.45)",
        }}
      />
      {options.map((o) => (
        <button
          key={o.v}
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className="relative z-10 flex items-center justify-center gap-1.5 py-1.5 rounded-md"
          style={{ color: value === o.v ? (o.v === "all" ? "var(--text-primary)" : "var(--accent)") : "var(--text-muted)", fontWeight: value === o.v ? 600 : 400 }}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Flag({ label, short }: { label: string; short: string }) {
  return (
    <span title={label} className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}>
      {short}
    </span>
  );
}

function BulkBtn({ children, onClick, disabled, danger }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button disabled={disabled} onClick={onClick} className="text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-40 hover:bg-white/5"
      style={danger ? { border: "1px solid rgba(239,68,68,0.45)", color: "#ef4444" } : { border: "1px solid var(--border-hover)", color: "var(--text-primary)" }}>
      {children}
    </button>
  );
}
