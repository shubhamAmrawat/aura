"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  createCategory,
  deleteCategory,
  listAdminCategories,
  listAdminWallpapers,
  reorderCategories,
  revalidateSite,
  slugify,
  updateCategory,
  type AdminCategory,
  type AdminWallpaper,
  type CategoryPatch,
} from "@/lib/adminApi";
import { useToast } from "@/lib/toast";
import { Modal, inputStyle } from "../_components/ui";
import { ChevronDownIcon, ChevronUpIcon, EyeIcon, EyeOffIcon, GripVerticalIcon, PenLineIcon, Trash2Icon } from "lucide-react";

const fmt = (n: number) => new Intl.NumberFormat("en-IN").format(n);
const SITE_NOTE = (ok: boolean) => (ok ? "site updated." : "site updates within a day (cache).");

export default function CategoriesPage() {
  const { toast } = useToast();
  const [saved, setSaved] = useState<AdminCategory[] | null>(null);
  const [order, setOrder] = useState<AdminCategory[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<AdminCategory | "new" | null>(null);
  const [deleting, setDeleting] = useState<AdminCategory | null>(null);
  const [q, setQ] = useState("");
  const [toggling, setToggling] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = useCallback(async () => {
    setError("");
    try {
      const rows = await listAdminCategories();
      setSaved(rows);
      setOrder(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const dirty = useMemo(() => !!saved && order.map((c) => c.id).join() !== saved.map((c) => c.id).join(), [order, saved]);
  const filtering = q.trim().length > 0;
  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? order.filter((c) => c.name.toLowerCase().includes(s) || c.slug.includes(s)) : order;
  }, [order, q]);

  const stats = useMemo(() => {
    const total = order.reduce((n, c) => n + c.total, 0);
    const empty = order.filter((c) => c.live === 0);
    const uncategorized = order.find((c) => c.slug === "uncategorized");
    const hiddenCats = order.filter((c) => c.isHidden);
    return { total, empty, uncategorized, hiddenCats };
  }, [order]);

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setOrder((prev) => arrayMove(prev, prev.findIndex((c) => c.id === active.id), prev.findIndex((c) => c.id === over.id)));
  };
  const move = (id: string, delta: number) =>
    setOrder((prev) => {
      const from = prev.findIndex((c) => c.id === id);
      const to = from + delta;
      return to < 0 || to >= prev.length ? prev : arrayMove(prev, from, to);
    });

  /** Hide/show a category and all its wallpapers on the public site. */
  const toggleHidden = async (c: AdminCategory) => {
    setToggling(c.id);
    try {
      await updateCategory(c.id, { isHidden: !c.isHidden });
      await load();
      const ok = await revalidateSite(["categories", "wallpapers", "featured"]);
      toast(`${c.name} ${c.isHidden ? "is visible again" : "is hidden"} — ${SITE_NOTE(ok)}`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to update category", "error");
    } finally {
      setToggling(null);
    }
  };

  const saveOrder = async () => {
    setSaving(true);
    try {
      const rows = await reorderCategories(order.map((c) => c.id));
      setSaved(rows);
      setOrder(rows);
      toast(`Order saved — ${SITE_NOTE(await revalidateSite(["categories"]))}`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to save order", "error");
      if (e instanceof Error && e.message.includes("changed")) void load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pb-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Categories</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            The site menu lists categories in this order. Drag to reorder.
          </p>
        </div>
        <div className="flex items-center gap-2">
        <Link
          href="/admin/categories/review"
          className="text-sm px-4 py-2 rounded-lg hover:bg-white/5"
          style={{ border: "1px solid var(--border-hover)", color: "var(--text-primary)" }}
        >
          AI suggestions
        </Link>
        <button
          onClick={() => setEditing("new")}
          disabled={dirty}
          title={dirty ? "Save or reset the order first" : undefined}
          className="text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-40"
          style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
        >
          + New category
        </button>
        </div>
      </div>

      {error && <p className="mt-6 text-sm px-4 py-3 rounded-lg" style={{ color: "#ef4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>{error}</p>}

      {!saved && !error && (
        <div className="mt-6 flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "var(--bg-secondary)" }} />)}
        </div>
      )}

      {saved && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] items-start">
          <aside className="lg:order-2 lg:sticky lg:top-6 flex flex-col gap-4">
            <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Overview</p>
              <dl className="grid grid-cols-2 gap-y-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                <dt>Categories</dt><dd className="text-right tabular-nums">{order.length}</dd>
                <dt>Wallpapers</dt><dd className="text-right tabular-nums">{fmt(stats.total)}</dd>
                <dt>Hidden from site</dt><dd className="text-right tabular-nums">{stats.hiddenCats.length}</dd>
              </dl>
              {stats.hiddenCats.length > 0 && (
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Hidden: {stats.hiddenCats.map((c) => c.name).join(", ")}. Their wallpapers don&apos;t appear anywhere on the public site.
                </p>
              )}
            </div>
            {(stats.uncategorized?.total || stats.empty.length > 0) ? (
              <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: "var(--bg-secondary)", border: "1px solid rgba(245,158,11,0.35)" }}>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Needs attention</p>
                {stats.uncategorized && stats.uncategorized.total > 0 && (
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    <b style={{ color: "#f59e0b" }}>{fmt(stats.uncategorized.total)}</b> wallpapers ({Math.round((stats.uncategorized.total / Math.max(1, stats.total)) * 100)}%) are uncategorized.{" "}
                    <Link href={`/admin/wallpapers?categoryId=${stats.uncategorized.id}`} className="underline">Sort them →</Link>
                  </p>
                )}
                {stats.empty.length > 0 && (
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {stats.empty.length} with no live wallpapers: {stats.empty.map((c) => c.name).join(", ")}.
                  </p>
                )}
              </div>
            ) : null}
          </aside>

          <div className="lg:order-1 min-w-0 flex flex-col gap-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter by name or slug"
              aria-label="Filter categories"
              className="rounded-lg px-3 py-2 text-sm max-w-xs"
              style={inputStyle}
            />
            {filtering && <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Clear the filter to reorder.</p>}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={visible.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                <ol className="flex flex-col gap-2">
                  {visible.map((c) => {
                    const i = order.indexOf(c);
                    return (
                      <CategoryRow
                        key={c.id}
                        cat={c}
                        index={i}
                        canUp={!filtering && i > 0}
                        canDown={!filtering && i < order.length - 1}
                        dragDisabled={filtering}
                        actionsDisabled={dirty}
                        onMove={(d) => move(c.id, d)}
                        onEdit={() => setEditing(c)}
                        onDelete={() => setDeleting(c)}
                        toggling={toggling === c.id}
                        onToggleHidden={() => void toggleHidden(c)}
                      />
                    );
                  })}
                  {visible.length === 0 && <p className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>No categories match.</p>}
                </ol>
              </SortableContext>
            </DndContext>
          </div>
        </div>
      )}

      {dirty && (
        <div className="fixed bottom-4 left-0 right-0 md:left-60 z-30 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl whitespace-nowrap" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-hover)", boxShadow: "0 16px 48px rgba(0,0,0,0.5)" }}>
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>Order changed</span>
            <button disabled={saving} onClick={() => saved && setOrder(saved)} className="text-xs px-3 py-2 rounded-lg hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>Reset</button>
            <button disabled={saving} onClick={saveOrder} className="text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-50" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>
              {saving ? "Saving…" : "Save order"}
            </button>
          </div>
        </div>
      )}

      {editing && (
        <CategoryEditor
          cat={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async (msg) => {
            setEditing(null);
            await load();
            toast(`${msg} — ${SITE_NOTE(await revalidateSite(["categories"]))}`, "success");
          }}
        />
      )}

      {deleting && (
        <DeleteCategory
          cat={deleting}
          others={order.filter((c) => c.id !== deleting.id)}
          onClose={() => setDeleting(null)}
          onDeleted={async (msg) => {
            setDeleting(null);
            await load();
            toast(`${msg} — ${SITE_NOTE(await revalidateSite(["categories", "wallpapers"]))}`, "success");
          }}
        />
      )}
    </div>
  );
}

function CategoryRow({ cat: c, index, canUp, canDown, dragDisabled, actionsDisabled, onMove, onEdit, onDelete, toggling, onToggleHidden }: {
  cat: AdminCategory;
  index: number;
  canUp: boolean;
  canDown: boolean;
  dragDisabled: boolean;
  actionsDisabled: boolean;
  onMove: (delta: number) => void;
  onEdit: () => void;
  onDelete: () => void;
  toggling: boolean;
  onToggleHidden: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: c.id, disabled: dragDisabled });
  const hidden = c.total - c.live;
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined, position: "relative" }}>
      <div
        className="flex items-center gap-3 rounded-xl px-3 py-2"
        style={{
          background: isDragging ? "var(--bg-elevated)" : "var(--bg-secondary)",
          border: "1px solid var(--border)",
          boxShadow: isDragging ? "0 12px 32px rgba(0,0,0,0.45)" : undefined,
          opacity: c.isHidden ? 0.6 : 1,
        }}
      >
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          disabled={dragDisabled}
          className="p-1.5 rounded cursor-grab active:cursor-grabbing hover:bg-white/5 touch-none disabled:opacity-25 disabled:cursor-default"
          style={{ color: "var(--text-muted)" }}
          aria-label={`Drag to reorder ${c.name}`}
        >
          <GripVerticalIcon size={14} strokeWidth={1} fill="currentColor" aria-hidden="true" />
        </button>
        <span className="w-6 text-center text-sm font-semibold tabular-nums" style={{ color: "var(--text-muted)" }}>{index + 1}</span>
        {c.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.previewUrl} alt="" loading="lazy" className="w-20 h-12 rounded object-cover shrink-0" style={{ background: "#111" }} />
        ) : (
          <div className="w-20 h-12 rounded shrink-0 flex items-center justify-center text-[10px]" style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-muted)" }}>Empty</div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate" style={{ color: "var(--text-primary)" }}>
            {c.name}
            {c.coverImageUrl && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(129,238,78,0.12)", color: "var(--accent)" }}>cover</span>}
            {c.isHidden && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.14)", color: "#f59e0b" }}>hidden from site</span>}
          </p>
          <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
            <a href={`/category/${c.slug}`} target="_blank" rel="noreferrer" className="hover:underline">/category/{c.slug} ↗</a>
            {c.description ? ` · ${c.description}` : ""}
          </p>
        </div>
        <div className="hidden sm:flex flex-col items-end text-[11px] tabular-nums shrink-0" style={{ color: "var(--text-secondary)" }}>
          <span><b style={{ color: c.live ? "var(--text-primary)" : "#f59e0b" }}>{fmt(c.live)}</b> live</span>
          {hidden > 0 && <span style={{ color: "var(--text-muted)" }}>+{fmt(hidden)} hidden</span>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Link href={`/admin/wallpapers?categoryId=${c.id}`} className="text-xs px-2 py-1.5 rounded hover:bg-white/5" style={{ color: "var(--text-secondary)" }} title="Open these wallpapers in the Wallpapers tab">
            Wallpapers
          </Link>
          <button aria-label={`Move ${c.name} up`} disabled={!canUp} onClick={() => onMove(-1)} className="p-1.5 rounded hover:bg-white/5 disabled:opacity-25" style={{ color: "var(--text-secondary)" }}>
            <ChevronUpIcon size={14} strokeWidth={2.2} aria-hidden="true" />
          </button>
          <button aria-label={`Move ${c.name} down`} disabled={!canDown} onClick={() => onMove(1)} className="p-1.5 rounded hover:bg-white/5 disabled:opacity-25" style={{ color: "var(--text-secondary)" }}>
            <ChevronDownIcon size={14} strokeWidth={2.2} aria-hidden="true" />
          </button>
          <button
            aria-label={c.isHidden ? `Show ${c.name} on the site` : `Hide ${c.name} from the site`}
            aria-pressed={c.isHidden}
            disabled={actionsDisabled || toggling}
            title={actionsDisabled ? "Save or reset the order first" : c.isHidden ? "Hidden — click to show on the site" : "Visible — click to hide from the site"}
            onClick={onToggleHidden}
            className="p-1.5 rounded hover:bg-white/5 disabled:opacity-25"
            style={{ color: c.isHidden ? "#f59e0b" : "var(--text-secondary)" }}
          >
            {c.isHidden ? (
              <EyeOffIcon size={14} strokeWidth={2} aria-hidden="true" />
            ) : (
              <EyeIcon size={14} strokeWidth={2} aria-hidden="true" />
            )}
          </button>
          <button aria-label={`Edit ${c.name}`} disabled={actionsDisabled} title={actionsDisabled ? "Save or reset the order first" : "Edit"} onClick={onEdit} className="p-1.5 rounded hover:bg-white/5 disabled:opacity-25" style={{ color: "var(--text-secondary)" }}>
            <PenLineIcon size={14} strokeWidth={2} aria-hidden="true" />
          </button>
          <button aria-label={`Delete ${c.name}`} disabled={actionsDisabled} title={actionsDisabled ? "Save or reset the order first" : "Delete"} onClick={onDelete} className="p-1.5 rounded hover:bg-white/5 disabled:opacity-25" style={{ color: "#ef4444" }}>
            <Trash2Icon size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>
    </li>
  );
}

/** Create (cat = null) or edit a category, including picking a cover from its own wallpapers. */
function CategoryEditor({ cat, onClose, onSaved }: { cat: AdminCategory | null; onClose: () => void; onSaved: (msg: string) => Promise<void> }) {
  const { toast } = useToast();
  const [name, setName] = useState(cat?.name ?? "");
  const [slug, setSlug] = useState(cat?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!cat);
  const [description, setDescription] = useState(cat?.description ?? "");
  const [intro, setIntro] = useState(cat?.intro ?? "");
  const [cover, setCover] = useState<string | null>(cat?.coverImageUrl ?? null);
  const [candidates, setCandidates] = useState<AdminWallpaper[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!cat) return;
    listAdminWallpapers({ categoryId: cat.id, status: "approved", sort: "downloads", limit: 12 })
      .then((p) => setCandidates(p.data))
      .catch(() => setCandidates([]));
  }, [cat]);

  const effectiveSlug = slugTouched ? slug : slugify(name);
  const slugChanged = !!cat && effectiveSlug !== cat.slug;

  const save = async () => {
    setErr("");
    setBusy(true);
    try {
      if (!cat) {
        await createCategory({ name: name.trim(), slug: effectiveSlug || undefined, description: description.trim() || null });
        await onSaved(`Created “${name.trim()}”`);
      } else {
        const patch: CategoryPatch = {};
        if (name.trim() !== cat.name) patch.name = name.trim();
        if (effectiveSlug !== cat.slug) patch.slug = effectiveSlug;
        if ((description.trim() || null) !== cat.description) patch.description = description.trim() || null;
        if ((intro.trim() || null) !== (cat.intro ?? null)) patch.intro = intro.trim() || null;
        if (cover !== cat.coverImageUrl) patch.coverImageUrl = cover;
        if (!Object.keys(patch).length) { onClose(); return; }
        await updateCategory(cat.id, patch);
        await onSaved(`Saved “${name.trim()}”`);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save");
      toast(e instanceof Error ? e.message : "Failed to save", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} busy={busy} width={cat ? 720 : 460} labelledBy="cat-editor-title">
      <p id="cat-editor-title" className="font-semibold" style={{ color: "var(--text-primary)" }}>{cat ? `Edit “${cat.name}”` : "New category"}</p>
      <label className="flex flex-col gap-1">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>Name</span>
        <input value={name} maxLength={40} autoFocus onChange={(e) => setName(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>Slug (page address)</span>
        <div className="flex items-center rounded-lg text-sm overflow-hidden" style={inputStyle}>
          <span className="pl-3 select-none" style={{ color: "var(--text-muted)" }}>/category/</span>
          <input
            aria-label="Slug"
            value={effectiveSlug}
            maxLength={40}
            onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); }}
            className="flex-1 bg-transparent py-2 pr-3 outline-none"
          />
        </div>
        {slugChanged && (
          <span className="text-[11px]" style={{ color: "#f59e0b" }}>
            The page address changes. Old links to /category/{cat!.slug} will redirect to the new one.
          </span>
        )}
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>Description <span className="opacity-70">(shown under the title on the category page)</span></span>
        <textarea value={description} maxLength={300} rows={2} onChange={(e) => setDescription(e.target.value)} className="rounded-lg px-3 py-2 text-sm resize-y" style={inputStyle} />
      </label>
      {cat && (
        <label className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Intro <span className="opacity-70">(a few paragraphs on the category page; leave a blank line between paragraphs)</span>
          </span>
          <textarea value={intro} maxLength={2500} rows={7} onChange={(e) => setIntro(e.target.value)} className="rounded-lg px-3 py-2 text-sm resize-y leading-relaxed" style={inputStyle} />
          <span className="text-[11px] self-end tabular-nums" style={{ color: "var(--text-muted)" }}>
            {intro.trim() ? intro.trim().split(/\s+/).length : 0} words · {intro.length}/2500
          </span>
        </label>
      )}

      {cat && (
        <div className="flex flex-col gap-2">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Cover <span className="opacity-70">(saved for category tiles — not shown on the site yet)</span>
          </span>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            <button
              type="button"
              onClick={() => setCover(null)}
              className="rounded-md text-[11px] flex items-center justify-center text-center p-1"
              style={{ aspectRatio: "16 / 10", border: `2px solid ${cover === null ? "var(--accent)" : "var(--border)"}`, color: "var(--text-secondary)", background: "rgba(255,255,255,0.03)" }}
              aria-pressed={cover === null}
            >
              Automatic
            </button>
            {cover && !candidates?.some((w) => w.fileUrl === cover) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover} alt="Current cover" className="w-full rounded-md object-cover" style={{ aspectRatio: "16 / 10", border: "2px solid var(--accent)" }} />
            )}
            {candidates?.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setCover(w.fileUrl)}
                aria-pressed={cover === w.fileUrl}
                title={w.title}
                className="rounded-md overflow-hidden"
                style={{ aspectRatio: "16 / 10", border: `2px solid ${cover === w.fileUrl ? "var(--accent)" : "transparent"}`, background: w.dominantColor }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={w.fileUrl} alt={w.title} loading="lazy" className="w-full h-full object-cover" />
              </button>
            ))}
            {candidates === null && Array.from({ length: 5 }).map((_, i) => <div key={i} className="rounded-md animate-pulse" style={{ aspectRatio: "16 / 10", background: "rgba(255,255,255,0.05)" }} />)}
          </div>
          {candidates?.length === 0 && <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>No live wallpapers in this category yet.</p>}
        </div>
      )}

      {err && <p className="text-xs" style={{ color: "#ef4444" }}>{err}</p>}
      <div className="flex justify-end gap-2">
        <button disabled={busy} onClick={onClose} className="text-sm px-4 py-2 rounded-lg hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>Cancel</button>
        <button
          disabled={busy || !name.trim() || effectiveSlug.length < 2}
          onClick={save}
          className="text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-40"
          style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
        >
          {busy ? "Saving…" : cat ? "Save" : "Create"}
        </button>
      </div>
    </Modal>
  );
}

/** Delete; a category that still has wallpapers must move them first (also how you merge two categories). */
function DeleteCategory({ cat, others, onClose, onDeleted }: { cat: AdminCategory; others: AdminCategory[]; onClose: () => void; onDeleted: (msg: string) => Promise<void> }) {
  const { toast } = useToast();
  const [moveTo, setMoveTo] = useState("");
  const [busy, setBusy] = useState(false);
  const needsMove = cat.total > 0;
  const target = others.find((c) => c.id === moveTo);

  const run = async () => {
    setBusy(true);
    try {
      const r = await deleteCategory(cat.id, needsMove ? moveTo : undefined);
      await onDeleted(r.moved ? `Moved ${fmt(r.moved)} wallpapers to “${target?.name}” and deleted “${cat.name}”` : `Deleted “${cat.name}”`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete", "error");
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} busy={busy} width={460} labelledBy="cat-delete-title">
      <p id="cat-delete-title" className="font-semibold" style={{ color: "var(--text-primary)" }}>Delete “{cat.name}”?</p>
      {needsMove ? (
        <>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            It has <b>{fmt(cat.total)}</b> wallpaper{cat.total === 1 ? "" : "s"}. Move {cat.total === 1 ? "it" : "them"} to another category first — this is also how you merge two categories. Links to /category/{cat.slug} will then redirect there.
          </p>
          <label className="flex flex-col gap-1">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Move wallpapers to</span>
            <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={inputStyle} aria-label="Move wallpapers to">
              <option value="">Choose a category…</option>
              {others.map((c) => <option key={c.id} value={c.id}>{c.name} ({fmt(c.total)})</option>)}
            </select>
          </label>
        </>
      ) : (
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>It has no wallpapers. Its page /category/{cat.slug} will stop working.</p>
      )}
      <div className="flex justify-end gap-2">
        <button disabled={busy} onClick={onClose} className="text-sm px-4 py-2 rounded-lg hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>Cancel</button>
        <button
          disabled={busy || (needsMove && !moveTo)}
          onClick={run}
          className="text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-40"
          style={{ background: "#ef4444", color: "#fff" }}
        >
          {busy ? "Working…" : needsMove ? "Move & delete" : "Delete"}
        </button>
      </div>
    </Modal>
  );
}
