"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  getFeatured,
  listAdminWallpapers,
  refreshHomeHero,
  resolutionOf,
  saveFeaturedLimit,
  saveFeaturedOrder,
  updateAdminWallpaper,
  type AdminWallpaper,
  type FeaturedItem,
  type FeaturedState,
} from "@/lib/adminApi";
import { useToast } from "@/lib/toast";
import { ConfirmDialog, Modal, StatusBadge, inputStyle } from "../_components/ui";
import WallpaperLightbox, { type LightboxWallpaper } from "../_components/WallpaperLightbox";

export default function FeaturedPage() {
  const { toast } = useToast();
  const [state, setState] = useState<FeaturedState | null>(null);
  const [order, setOrder] = useState<FeaturedItem[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [limitBusy, setLimitBusy] = useState(false);
  const [limitDraft, setLimitDraft] = useState("");
  /** Limit implied by where the reserve divider sits; saved together with the order. */
  const [draftLimit, setDraftLimit] = useState(0);
  const cancelLimitEdit = useRef(false);
  const [removing, setRemoving] = useState<FeaturedItem | null>(null);
  const [busyRemove, setBusyRemove] = useState(false);
  const [picker, setPicker] = useState(false);
  const [preview, setPreview] = useState<LightboxWallpaper | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const apply = (s: FeaturedState) => {
    setState(s);
    setOrder(s.items);
    setLimitDraft(String(s.limit));
    setDraftLimit(s.limit);
  };

  const load = useCallback(async () => {
    setError("");
    try {
      apply(await getFeatured());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const orderChanged = useMemo(() => !!state && order.map((w) => w.id).join() !== state.items.map((w) => w.id).join(), [order, state]);
  const limitChanged = !!state && draftLimit !== state.limit;
  const dirty = orderChanged || limitChanged;

  // Which items the home page actually shows: the first `limit` LIVE ones, in order
  const shownIds = useMemo(
    () => new Set(order.filter((w) => w.status === "approved").slice(0, draftLimit).map((w) => w.id)),
    [order, draftLimit]
  );
  const lastShownIndex = useMemo(() => order.reduce((last, w, i) => (shownIds.has(w.id) ? i : last), -1), [order, shownIds]);

  // The list as rendered: wallpapers with the reserve divider (always present, even with no reserve) in between
  const rows = useMemo(() => {
    const ids = order.map((w) => w.id);
    ids.splice(lastShownIndex + 1, 0, DIVIDER);
    return ids;
  }, [order, lastShownIndex]);

  /** Apply a rearranged row list: wallpapers above the divider are shown, so the limit follows the divider. */
  const commitRows = (next: string[]) => {
    if (!state) return;
    const byId = new Map(order.map((w) => [w.id, w]));
    const cut = next.indexOf(DIVIDER);
    let limit = next.slice(0, cut).filter((id) => byId.get(id)?.status === "approved").length;
    if (limit < 1) { limit = 1; toast("At least one wallpaper stays on the home page.", "error"); }
    if (limit > state.maxLimit) { limit = state.maxLimit; toast(`The home page shows at most ${state.maxLimit}.`, "error"); }
    setOrder(next.filter((id) => id !== DIVIDER).map((id) => byId.get(id)!));
    setDraftLimit(limit);
  };

  /** Returns the suffix for the success toast: instant refresh, or the 2-minute cache fallback. */
  const refreshSite = async () => ((await refreshHomeHero()) ? "home page updated." : "home page updates within 2 minutes.");

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    commitRows(arrayMove(rows, rows.indexOf(String(active.id)), rows.indexOf(String(over.id))));
  };

  const move = (id: string, delta: number) => {
    const from = rows.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= rows.length) return;
    commitRows(arrayMove(rows, from, to));
  };

  const saveOrder = async () => {
    if (!state) return;
    setSaving(true);
    try {
      const nextLimit = draftLimit;
      if (orderChanged) apply(await saveFeaturedOrder(order.map((w) => w.id)));
      if (nextLimit !== state.limit) {
        const s = await saveFeaturedLimit(nextLimit);
        setState((prev) => (prev ? { ...prev, limit: s.limit } : s));
        setLimitDraft(String(s.limit));
        setDraftLimit(s.limit);
      }
      toast(`Saved — ${await refreshSite()}`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to save order", "error");
      if (e instanceof Error && e.message.includes("changed")) void load();
    } finally {
      setSaving(false);
    }
  };

  const changeLimit = async (next: number) => {
    if (!state) return;
    if (!Number.isInteger(next) || next < 1 || next > state.maxLimit) {
      toast(`Enter a whole number from 1 to ${state.maxLimit}.`, "error");
      setLimitDraft(String(state.limit));
      return;
    }
    if (next === state.limit) { setLimitDraft(String(state.limit)); return; }
    setLimitBusy(true);
    try {
      const s = await saveFeaturedLimit(next);
      setState((prev) => (prev ? { ...prev, limit: s.limit } : s));
      setLimitDraft(String(s.limit));
      setDraftLimit(s.limit);
      toast(`Now showing ${s.limit} — ${await refreshSite()}`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to save", "error");
      setLimitDraft(String(state.limit));
    } finally {
      setLimitBusy(false);
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setBusyRemove(true);
    try {
      await updateAdminWallpaper(removing.id, { isFeatured: false });
      setRemoving(null);
      await load();
      toast(`Removed from featured — ${await refreshSite()}`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to remove", "error");
    } finally {
      setBusyRemove(false);
    }
  };

  return (
    <div className="pb-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Featured</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            The home page hero shows the first live wallpapers in this order. Drag to reorder.
          </p>
        </div>
        <button
          onClick={() => setPicker(true)}
          disabled={dirty}
          title={dirty ? "Save or reset the order first" : undefined}
          className="text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-40"
          style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
        >
          + Add wallpapers
        </button>
      </div>

      {error && <p className="mt-6 text-sm px-4 py-3 rounded-lg" style={{ color: "#ef4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>{error}</p>}

      {state && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
          {/* Side panel: limit + live home preview (above the list on small screens) */}
          <aside className="lg:order-2 lg:sticky lg:top-6 flex flex-col gap-4">
            <div className="rounded-xl p-4" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
              <label htmlFor="featured-limit" className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Shown on the home page</label>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {order.length} featured · {shownIds.size} shown · the rest wait in reserve
              </p>
              <div className="mt-3 flex items-center gap-2" role="group" aria-label="Number shown on home page">
                <button aria-label="Show one fewer" disabled={limitBusy || dirty || state.limit <= 1} onClick={() => changeLimit(state.limit - 1)} className="w-9 h-9 rounded-lg text-lg disabled:opacity-30 hover:bg-white/5" style={{ border: "1px solid var(--border-hover)", color: "var(--text-primary)" }}>−</button>
                <input
                  id="featured-limit"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={state.maxLimit}
                  value={dirty ? String(draftLimit) : limitDraft}
                  disabled={limitBusy || dirty}
                  title={dirty ? "Save or reset your changes first" : undefined}
                  onChange={(e) => setLimitDraft(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
                  onBlur={() => {
                    if (cancelLimitEdit.current) { cancelLimitEdit.current = false; setLimitDraft(String(state.limit)); return; }
                    void changeLimit(Number(limitDraft));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") { cancelLimitEdit.current = true; e.currentTarget.blur(); }
                  }}
                  className="w-16 h-9 rounded-lg text-center text-lg font-semibold tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  style={inputStyle}
                />
                <button aria-label="Show one more" disabled={limitBusy || dirty || state.limit >= state.maxLimit} onClick={() => changeLimit(state.limit + 1)} className="w-9 h-9 rounded-lg text-lg disabled:opacity-30 hover:bg-white/5" style={{ border: "1px solid var(--border-hover)", color: "var(--text-primary)" }}>+</button>
                <span className="text-xs ml-1" style={{ color: "var(--text-muted)" }}>1–{state.maxLimit}</span>
              </div>
              <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>Type a number and press Enter, or use − / +.</p>
            </div>

            {shownIds.size > 0 && (
              <div className="rounded-xl p-4" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Home page preview</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{dirty ? "Unsaved order" : "Live"} · hero rotates in this order</p>
                <ol className="mt-3 grid grid-cols-2 gap-2">
                  {order.filter((w) => shownIds.has(w.id)).map((w, i) => (
                    <li key={w.id} className={`relative rounded-md overflow-hidden ${i === 0 ? "col-span-2" : ""}`} style={{ aspectRatio: "16 / 9", background: w.dominantColor }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={w.fileUrl} alt={w.title} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                      <span className="absolute top-1 left-1 text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "rgba(0,0,0,0.65)", color: "#fff" }}>{i + 1}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </aside>

          {/* List */}
          <div className="lg:order-1 min-w-0">
          {order.length === 0 ? (
            <div className="mt-10 text-center">
              <p className="font-semibold" style={{ color: "var(--text-primary)" }}>Nothing featured yet</p>
              <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Add wallpapers to fill the home page hero.</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={rows} strategy={verticalListSortingStrategy}>
                <ol className="flex flex-col gap-2">
                  {rows.map((id, r) => {
                    if (id === DIVIDER) return <ReserveDivider key={id} empty={r === rows.length - 1} onMove={(d) => move(DIVIDER, d)} canUp={r > 0} canDown={r < rows.length - 1} />;
                    const i = order.findIndex((w) => w.id === id);
                    const w = order[i];
                    if (!w) return null;
                    return (
                      <FeaturedRow
                        key={w.id}
                        item={w}
                        index={i}
                        shown={shownIds.has(w.id)}
                        canUp={r > 0}
                        canDown={r < rows.length - 1}
                        onMove={(d) => move(w.id, d)}
                        onRemove={() => setRemoving(w)}
                        onPreview={() => setPreview(w)}
                        removeDisabled={dirty}
                      />
                    );
                  })}
                </ol>
              </SortableContext>
            </DndContext>
          )}
          </div>
        </div>
      )}

      {!state && !error && (
        <div className="mt-6 flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: "var(--bg-secondary)" }} />)}
        </div>
      )}

      {/* Save bar */}
      {dirty && (
        <div className="fixed bottom-4 left-0 right-0 md:left-60 z-30 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl whitespace-nowrap" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-hover)", boxShadow: "0 16px 48px rgba(0,0,0,0.5)" }}>
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>{orderChanged && limitChanged ? `Order changed · showing ${draftLimit}` : limitChanged ? `Showing ${draftLimit} (was ${state?.limit})` : "Order changed"}</span>
            <button disabled={saving} onClick={() => { if (state) { setOrder(state.items); setDraftLimit(state.limit); } }} className="text-xs px-3 py-2 rounded-lg hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>Reset</button>
            <button disabled={saving} onClick={saveOrder} className="text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-50" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {removing && (
        <ConfirmDialog
          title="Remove from featured?"
          body={<>“{removing.title}” stays live on the site; it just leaves the home page hero.</>}
          confirmLabel="Remove"
          busy={busyRemove}
          onCancel={() => setRemoving(null)}
          onConfirm={confirmRemove}
        />
      )}

      {picker && (
        <AddPicker
          onClose={() => setPicker(false)}
          onAdded={async (title) => {
            await load();
            toast(`Added “${title}” at the end — ${await refreshSite()}`, "success");
          }}
        />
      )}

      {preview && <WallpaperLightbox wallpaper={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

const DIVIDER = "__reserve__";

/** Draggable line between what the home page shows and the reserve. Always rendered, so it doubles as a drop target. */
function ReserveDivider({ empty, canUp, canDown, onMove }: { empty: boolean; canUp: boolean; canDown: boolean; onMove: (delta: number) => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: DIVIDER });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined, position: "relative" }}>
      <div
        className="flex items-center gap-3 rounded-xl px-3"
        style={{
          minHeight: empty ? 64 : 36,
          border: empty ? "1px dashed var(--border-hover)" : "1px solid transparent",
          background: isDragging ? "var(--bg-elevated)" : undefined,
        }}
      >
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="p-1.5 rounded cursor-grab active:cursor-grabbing hover:bg-white/5 touch-none"
          style={{ color: "var(--text-muted)" }}
          aria-label="Drag the reserve line to change how many are shown"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></svg>
        </button>
        <span className="h-px flex-1" style={{ background: "var(--border-hover)" }} />
        <span className="text-[11px] uppercase tracking-wider text-center" style={{ color: "var(--text-muted)" }}>
          {empty ? "Reserve · drag a wallpaper here to hide it from the home page" : "Reserve · not shown"}
        </span>
        <span className="h-px flex-1" style={{ background: "var(--border-hover)" }} />
        <div className="flex items-center gap-1">
          <button aria-label="Move reserve line up" disabled={!canUp} onClick={() => onMove(-1)} className="p-1.5 rounded hover:bg-white/5 disabled:opacity-25" style={{ color: "var(--text-secondary)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="18 15 12 9 6 15" /></svg>
          </button>
          <button aria-label="Move reserve line down" disabled={!canDown} onClick={() => onMove(1)} className="p-1.5 rounded hover:bg-white/5 disabled:opacity-25" style={{ color: "var(--text-secondary)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="6 9 12 15 18 9" /></svg>
          </button>
          <span className="w-[26px]" />
        </div>
      </div>
    </li>
  );
}

function FeaturedRow({ item: w, index, shown, canUp, canDown, onMove, onRemove, onPreview, removeDisabled }: {
  item: FeaturedItem;
  index: number;
  shown: boolean;
  canUp: boolean;
  canDown: boolean;
  onMove: (delta: number) => void;
  onRemove: () => void;
  onPreview: () => void;
  removeDisabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: w.id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined, position: "relative" }}>
      <div
        className="flex items-center gap-3 rounded-xl px-3 py-2"
        style={{
          background: isDragging ? "var(--bg-elevated)" : "var(--bg-secondary)",
          border: `1px solid ${shown ? "rgba(129,238,78,0.35)" : "var(--border)"}`,
          opacity: shown || isDragging ? 1 : 0.6,
          boxShadow: isDragging ? "0 12px 32px rgba(0,0,0,0.45)" : undefined,
        }}
      >
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="p-1.5 rounded cursor-grab active:cursor-grabbing hover:bg-white/5 touch-none"
          style={{ color: "var(--text-muted)" }}
          aria-label={`Drag to reorder ${w.title}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></svg>
        </button>
        <span className="w-6 text-center text-sm font-semibold tabular-nums" style={{ color: shown ? "var(--accent)" : "var(--text-muted)" }}>{index + 1}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={w.fileUrl} alt="" loading="lazy" onClick={onPreview} className="w-20 h-12 rounded object-cover cursor-zoom-in shrink-0" style={{ background: w.dominantColor }} title="View full size" />
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{w.title}</p>
          <p className="text-[11px] flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
            <span>{w.isMobile ? "Mobile" : "Desktop"} · {resolutionOf(w.width, w.height).label}</span>
            {w.status !== "approved" ? <><StatusBadge status={w.status} /> <span>not live — skipped on the home page</span></> : shown ? <span style={{ color: "var(--accent)" }}>On home page</span> : null}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button aria-label="Move up" disabled={!canUp} onClick={() => onMove(-1)} className="p-1.5 rounded hover:bg-white/5 disabled:opacity-25" style={{ color: "var(--text-secondary)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="18 15 12 9 6 15" /></svg>
          </button>
          <button aria-label="Move down" disabled={!canDown} onClick={() => onMove(1)} className="p-1.5 rounded hover:bg-white/5 disabled:opacity-25" style={{ color: "var(--text-secondary)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="6 9 12 15 18 9" /></svg>
          </button>
          <button
            aria-label={`Remove ${w.title} from featured`}
            disabled={removeDisabled}
            title={removeDisabled ? "Save or reset the order first" : "Remove from featured"}
            onClick={onRemove}
            className="p-1.5 rounded hover:bg-white/5 disabled:opacity-25"
            style={{ color: "#ef4444" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      </div>
    </li>
  );
}

/** Search live, not-yet-featured wallpapers and add them to the end of the list. */
function AddPicker({ onClose, onAdded }: { onClose: () => void; onAdded: (title: string) => Promise<void> }) {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<AdminWallpaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const page = await listAdminWallpapers({ q: q.trim() || undefined, status: "approved", featured: "false", sort: "trending", limit: 24 });
        if (alive) setResults(page.data);
      } catch {
        if (alive) setResults([]);
      } finally {
        if (alive) setLoading(false);
      }
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  const add = async (w: AdminWallpaper) => {
    setAdding(w.id);
    try {
      await updateAdminWallpaper(w.id, { isFeatured: true });
      setResults((prev) => prev.filter((x) => x.id !== w.id));
      await onAdded(w.title);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to add", "error");
    } finally {
      setAdding(null);
    }
  };

  return (
    <Modal onClose={onClose} width={760} labelledBy="picker-title">
      <div className="flex items-center justify-between gap-3">
        <p id="picker-title" className="font-semibold" style={{ color: "var(--text-primary)" }}>Add to featured</p>
        <button onClick={onClose} className="text-sm px-2 py-1 rounded hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>Done</button>
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="Search live wallpapers by title or tag" className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 content-start min-h-[200px] max-h-[60vh] overflow-y-auto pr-1" style={{ opacity: loading ? 0.6 : 1 }}>
        {results.map((w) => (
          <div key={w.id} className="rounded-lg overflow-hidden flex flex-col shrink-0" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={w.fileUrl} alt="" loading="lazy" className="w-full aspect-video object-cover" style={{ background: w.dominantColor }} />
            <div className="p-2 flex flex-col gap-1.5">
              <p className="text-xs truncate" style={{ color: "var(--text-primary)" }} title={w.title}>{w.title}</p>
              <button disabled={adding !== null} onClick={() => add(w)} className="text-xs font-semibold py-1.5 rounded-md disabled:opacity-40" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>
                {adding === w.id ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        ))}
        {!loading && results.length === 0 && <p className="col-span-full text-sm text-center py-10" style={{ color: "var(--text-muted)" }}>No live, unfeatured wallpapers match.</p>}
      </div>
    </Modal>
  );
}
