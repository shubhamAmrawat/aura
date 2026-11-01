"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon, XIcon } from "lucide-react";
import {
  createDrop,
  deleteDrop,
  getDrop,
  listAdminWallpapers,
  listDrops,
  refreshHomeHero,
  setDropWallpapers,
  updateDrop,
  type AdminDrop,
  type AdminDropItem,
  type AdminDropSummary,
  type AdminWallpaper,
  type DropStatus,
} from "@/lib/adminApi";
import { accentFrom, dropName, dropTitle } from "@/lib/drops";
import { useToast } from "@/lib/toast";
import DropBanner from "@/app/components/DropBanner";
import { ConfirmDialog, Modal, StatusBadge, Toggle, inputStyle } from "../_components/ui";

const STATUS: Record<DropStatus, { label: string; bg: string; fg: string }> = {
  draft: { label: "Draft", bg: "rgba(255,255,255,0.08)", fg: "var(--text-secondary)" },
  scheduled: { label: "Scheduled", bg: "rgba(96,165,250,0.15)", fg: "#93C5FD" },
  live: { label: "Live", bg: "rgba(129,238,78,0.15)", fg: "var(--accent)" },
  ended: { label: "Ended", bg: "rgba(255,255,255,0.06)", fg: "var(--text-muted)" },
};

function DropBadge({ status }: { status: DropStatus }) {
  const s = STATUS[status];
  return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: s.bg, color: s.fg }}>{s.label}</span>;
}

/** ISO → value for <input type="datetime-local"> in the admin's own time zone. */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : null;

function windowLabel(d: { startsAt: string | null; endsAt: string | null }) {
  const s = fmtDate(d.startsAt), e = fmtDate(d.endsAt);
  if (!s && !e) return "no dates";
  return `${s ?? "now"} – ${e ?? "open-ended"}`;
}

type Form = { name: string; description: string; startsAt: string; endsAt: string; showOnApp: boolean; showOnWeb: boolean };
const formOf = (d: AdminDrop["drop"]): Form => ({
  name: dropName(d.title),
  description: d.description ?? "",
  startsAt: toLocalInput(d.startsAt),
  endsAt: toLocalInput(d.endsAt),
  showOnApp: d.showOnApp,
  showOnWeb: d.showOnWeb,
});

export default function DropsPage() {
  const { toast } = useToast();
  const [drops, setDrops] = useState<AdminDropSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminDrop | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [items, setItems] = useState<AdminDropItem[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [picker, setPicker] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const loadList = useCallback(async () => {
    try {
      const list = await listDrops();
      setDrops(list);
      return list;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load drops");
      return [];
    }
  }, []);

  const apply = (d: AdminDrop) => {
    setDetail(d);
    setForm(formOf(d.drop));
    setItems(d.wallpapers);
  };

  useEffect(() => {
    void loadList().then((list) => { if (list[0]) setSelectedId((id) => id ?? list[0]!.id); });
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) return;
    let alive = true;
    setDetail(null);
    getDrop(selectedId)
      .then((d) => { if (alive) apply(d); })
      .catch((e) => { if (alive) toast(e instanceof Error ? e.message : "Failed to load drop", "error"); });
    return () => { alive = false; };
  }, [selectedId, toast]);

  const itemsChanged = useMemo(() => !!detail && items.map((i) => i.id).join() !== detail.wallpapers.map((i) => i.id).join(), [items, detail]);
  const formChanged = useMemo(() => !!detail && !!form && JSON.stringify(form) !== JSON.stringify(formOf(detail.drop)), [form, detail]);
  const dirty = itemsChanged || formChanged;

  // Banner preview: the same picks the API makes — live wallpapers, portrait first, in order
  const bannerItems = useMemo(() => {
    const live = items.filter((i) => i.status === "approved");
    return [...live.filter((i) => i.isMobile), ...live.filter((i) => !i.isMobile)].slice(0, 4);
  }, [items]);
  const liveCount = items.filter((i) => i.status === "approved").length;

  const selectDrop = (id: string) => {
    if (id === selectedId) return;
    if (dirty && !window.confirm("Discard unsaved changes to this drop?")) return;
    setSelectedId(id);
  };

  /** Saves the form + wallpapers; `published` also publishes / unpublishes. */
  const save = async (published?: boolean) => {
    if (!detail || !form) return;
    if (!form.name.trim()) { toast("Give the drop a name.", "error"); return; }
    if (form.startsAt && form.endsAt && new Date(form.endsAt) <= new Date(form.startsAt)) { toast("The end must be after the start.", "error"); return; }
    if (published && liveCount === 0) { toast("Add at least one live wallpaper before publishing.", "error"); return; }
    setSaving(true);
    try {
      let next = detail;
      if (itemsChanged) next = await setDropWallpapers(detail.drop.id, items.map((i) => i.id));
      if (formChanged || published !== undefined) {
        next = await updateDrop(detail.drop.id, {
          title: dropTitle(form.name),
          description: form.description.trim() || null,
          startsAt: fromLocalInput(form.startsAt),
          endsAt: fromLocalInput(form.endsAt),
          showOnApp: form.showOnApp,
          showOnWeb: form.showOnWeb,
          ...(published !== undefined ? { published } : {}),
        });
      }
      apply(next);
      await loadList();
      const site = (await refreshHomeHero()) ? "website updated" : "website updates within 2 minutes";
      toast(
        published === true ? `Published — ${next.drop.status === "scheduled" ? `goes live ${fmtDate(next.drop.startsAt)}` : `live now, ${site}`}.`
          : published === false ? "Moved back to draft — the banner is gone." : `Saved${next.drop.status === "live" ? ` — ${site}` : ""}.`,
        "success"
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  const newDrop = async (name: string) => {
    setCreating(true);
    try {
      const d = await createDrop({ title: dropTitle(name) });
      await loadList();
      setSelectedId(d.drop.id);
      apply(d);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to create drop", "error");
      throw e;
    } finally {
      setCreating(false);
    }
  };

  const remove = async () => {
    if (!detail) return;
    setDeleting(true);
    try {
      await deleteDrop(detail.drop.id);
      setConfirmDelete(false);
      setDetail(null);
      setForm(null);
      const list = await loadList();
      setSelectedId(list[0]?.id ?? null);
      await refreshHomeHero();
      toast("Drop deleted.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete", "error");
    } finally {
      setDeleting(false);
    }
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setItems((prev) => arrayMove(prev, prev.findIndex((i) => i.id === active.id), prev.findIndex((i) => i.id === over.id)));
  };

  const [newOpen, setNewOpen] = useState(false);
  const status = detail?.drop.status;

  return (
    <div className="pb-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Drops</h1>
          <p className="text-sm mt-1 max-w-2xl" style={{ color: "var(--text-secondary)" }}>
            Limited collections like “Diwali Drops”. While live, a drop shows as a banner on the app and website home pages. The banner is made from its first wallpapers. The drop page keeps working after it ends.
          </p>
        </div>
        <button onClick={() => setNewOpen(true)} className="text-sm font-semibold px-4 py-2 rounded-lg" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>
          + New drop
        </button>
      </div>

      {error && <p className="mt-6 text-sm px-4 py-3 rounded-lg" style={{ color: "#ef4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>{error}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] items-start">
        {/* Drops list */}
        <nav aria-label="Drops" className="flex flex-col gap-2">
          {drops?.map((d) => (
            <button
              key={d.id}
              onClick={() => selectDrop(d.id)}
              aria-current={d.id === selectedId ? "true" : undefined}
              className="flex gap-3 p-2.5 rounded-xl text-left"
              style={{ background: d.id === selectedId ? "var(--bg-elevated)" : "var(--bg-secondary)", border: `1px solid ${d.id === selectedId ? "var(--border-hover)" : "var(--border)"}` }}
            >
              {d.coverThumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.coverThumbUrl} alt="" className="w-10 h-14 rounded-md object-cover shrink-0" />
              ) : (
                <span className="w-10 h-14 rounded-md shrink-0" style={{ background: "rgba(255,255,255,0.06)" }} />
              )}
              <span className="flex-1 min-w-0 flex flex-col gap-1">
                <span className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{d.title}</span>
                <span className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{d.wallpaperCount} wallpapers · {windowLabel(d)}</span>
                <span><DropBadge status={d.status} /></span>
              </span>
            </button>
          ))}
          {drops && drops.length === 0 && (
            <p className="text-sm p-4 rounded-xl text-center" style={{ color: "var(--text-muted)", border: "1px dashed var(--border-hover)" }}>No drops yet.</p>
          )}
          {!drops && !error && Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-[76px] rounded-xl animate-pulse" style={{ background: "var(--bg-secondary)" }} />)}
        </nav>

        {/* Editor */}
        {detail && form ? (
          <section className="min-w-0 flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <h2 className="text-xl font-bold truncate" style={{ color: "var(--text-primary)" }}>{dropTitle(form.name || "Untitled")}</h2>
                {status && <DropBadge status={status} />}
                {status === "scheduled" && <span className="text-xs" style={{ color: "var(--text-muted)" }}>goes live {fmtDate(detail.drop.startsAt)}</span>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setConfirmDelete(true)} disabled={saving} className="text-xs px-3 py-2 rounded-lg hover:bg-white/5" style={{ color: "#ef4444" }}>Delete</button>
                {status !== "draft" && (
                  <button onClick={() => save(false)} disabled={saving} className="text-xs px-3 py-2 rounded-lg hover:bg-white/5" style={{ color: "var(--text-secondary)", border: "1px solid var(--border-hover)" }}>Unpublish</button>
                )}
                <button onClick={() => save()} disabled={saving || !dirty} className="text-xs px-3 py-2 rounded-lg hover:bg-white/5 disabled:opacity-40" style={{ color: "var(--text-primary)", border: "1px solid var(--border-hover)" }}>
                  {saving ? "Saving…" : status === "draft" ? "Save draft" : "Save"}
                </button>
                {status === "draft" && (
                  <button onClick={() => save(true)} disabled={saving} className="text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-50" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>Publish</button>
                )}
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              {/* Details */}
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1.5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Name
                  <input value={form.name} maxLength={50} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Diwali" className="rounded-lg px-3 py-2 text-sm font-normal" style={inputStyle} />
                  <span className="font-normal" style={{ color: "var(--text-muted)" }}>Shown as “{dropTitle(form.name || "Diwali")}”.</span>
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Description
                  <textarea value={form.description} maxLength={300} rows={3} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Diyas, lanterns, rangoli and fireworks — a festive set for your screens." className="rounded-lg px-3 py-2 text-sm font-normal resize-none" style={inputStyle} />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                    Starts
                    <input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} className="rounded-lg px-3 py-2 text-sm font-normal [color-scheme:dark]" style={inputStyle} />
                  </label>
                  <label className="flex flex-col gap-1.5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                    Ends
                    <input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} className="rounded-lg px-3 py-2 text-sm font-normal [color-scheme:dark]" style={inputStyle} />
                  </label>
                </div>
                <p className="text-[11px] -mt-1" style={{ color: "var(--text-muted)" }}>Your local time. Empty start = live as soon as it's published; empty end = runs until you unpublish.</p>
                <div className="rounded-lg px-3 py-1" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                  <Toggle label="Banner on app home" checked={form.showOnApp} onChange={(v) => setForm({ ...form, showOnApp: v })} />
                  <Toggle label="Banner on website home" checked={form.showOnWeb} onChange={(v) => setForm({ ...form, showOnWeb: v })} />
                </div>
              </div>

              {/* Banner preview */}
              <div className="flex flex-col gap-2 min-w-0">
                <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Banner preview · made from the first wallpapers (phone ones first)</span>
                {bannerItems.length ? (
                  <DropBanner
                    preview
                    drop={{
                      id: detail.drop.id,
                      title: dropTitle(form.name || "Untitled"),
                      description: form.description.trim() || null,
                      startsAt: fromLocalInput(form.startsAt),
                      endsAt: fromLocalInput(form.endsAt),
                      wallpaperCount: liveCount,
                      accentColor: accentFrom(bannerItems.map((i) => i.dominantColor)),
                      preview: bannerItems,
                    }}
                  />
                ) : (
                  <div className="h-[220px] rounded-2xl flex items-center justify-center text-sm" style={{ border: "1px dashed var(--border-hover)", color: "var(--text-muted)" }}>Add live wallpapers to see the banner.</div>
                )}
                <span className="text-[11px] flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
                  Accent colour (auto): <span className="inline-block w-3 h-3 rounded" style={{ background: accentFrom(bannerItems.map((i) => i.dominantColor)) }} /> {accentFrom(bannerItems.map((i) => i.dominantColor))} · reorder the wallpapers to change the banner.
                </span>
              </div>
            </div>

            {/* Wallpapers */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Wallpapers <span className="font-normal" style={{ color: "var(--text-muted)" }}>· {items.length}{liveCount !== items.length ? ` (${liveCount} live)` : ""} · drag to reorder</span>
                </p>
                <button onClick={() => setPicker(true)} className="text-xs font-semibold px-3 py-2 rounded-lg" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>+ Add wallpapers</button>
              </div>
              {items.length === 0 ? (
                <p className="text-sm py-10 text-center rounded-xl" style={{ color: "var(--text-muted)", border: "1px dashed var(--border-hover)" }}>
                  No wallpapers yet. Add some here, or pick this drop in Bulk upload.
                </p>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
                    <ol className="grid gap-3 grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
                      {items.map((w, i) => (
                        <DropTile key={w.id} item={w} index={i} onRemove={() => setItems((prev) => prev.filter((x) => x.id !== w.id))} />
                      ))}
                    </ol>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </section>
        ) : selectedId ? (
          <div className="h-80 rounded-xl animate-pulse" style={{ background: "var(--bg-secondary)" }} />
        ) : drops?.length === 0 ? (
          <div className="py-16 text-center rounded-xl" style={{ border: "1px dashed var(--border-hover)" }}>
            <p className="font-semibold" style={{ color: "var(--text-primary)" }}>Create your first drop</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>For example “Diwali”, shown as “Diwali Drops”.</p>
          </div>
        ) : null}
      </div>

      {dirty && (
        <div className="fixed bottom-4 left-0 right-0 md:left-60 z-30 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl whitespace-nowrap" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-hover)", boxShadow: "0 16px 48px rgba(0,0,0,0.5)" }}>
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>Unsaved changes</span>
            <button disabled={saving} onClick={() => detail && apply(detail)} className="text-xs px-3 py-2 rounded-lg hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>Reset</button>
            <button disabled={saving} onClick={() => save()} className="text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-50" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </div>
      )}

      {newOpen && <NewDropDialog busy={creating} onClose={() => setNewOpen(false)} onCreate={async (name) => { await newDrop(name); setNewOpen(false); }} />}

      {confirmDelete && detail && (
        <ConfirmDialog
          title={`Delete ${detail.drop.title}?`}
          body="The banner and the drop page go away. The wallpapers themselves stay live."
          confirmLabel="Delete"
          danger
          busy={deleting}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={remove}
        />
      )}

      {picker && (
        <DropPicker
          selected={items}
          onClose={() => setPicker(false)}
          onToggle={(w) =>
            setItems((prev) =>
              prev.some((x) => x.id === w.id)
                ? prev.filter((x) => x.id !== w.id)
                : [...prev, { id: w.id, title: w.title, fileUrl: w.fileUrl, thumbUrl: w.thumbUrl ?? null, blurhash: null, dominantColor: w.dominantColor, width: w.width, height: w.height, isMobile: w.isMobile, status: w.status }]
            )
          }
        />
      )}
    </div>
  );
}

function DropTile({ item: w, index, onRemove }: { item: AdminDropItem; index: number; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: w.id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }} className="relative">
      <div
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder ${w.title}`}
        className="relative rounded-xl overflow-hidden cursor-grab active:cursor-grabbing touch-none aspect-[9/16]"
        style={{ background: w.dominantColor, border: "1px solid var(--border)", opacity: w.status === "approved" || isDragging ? 1 : 0.55, boxShadow: isDragging ? "0 12px 32px rgba(0,0,0,0.5)" : undefined }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={w.thumbUrl ?? w.fileUrl} alt={w.title} loading="lazy" draggable={false} className="absolute inset-0 w-full h-full object-cover" />
        <span className="absolute top-1.5 left-1.5 min-w-5 h-5 px-1 rounded-full text-[11px] font-bold flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)", color: "#fff" }}>{index + 1}</span>
        <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1">
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(0,0,0,0.7)", color: "#ddd" }}>{w.isMobile ? "Phone" : "Desktop"}</span>
          {w.status !== "approved" && <StatusBadge status={w.status} />}
        </span>
        <GripVerticalIcon size={14} className="absolute bottom-1.5 right-1.5 opacity-70" style={{ color: "#fff" }} aria-hidden="true" />
      </div>
      <button
        onClick={onRemove}
        aria-label={`Remove ${w.title} from the drop`}
        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center hover:bg-black"
        style={{ background: "rgba(0,0,0,0.7)", color: "#fff" }}
      >
        <XIcon size={13} strokeWidth={2.4} aria-hidden="true" />
      </button>
    </li>
  );
}

function NewDropDialog({ busy, onClose, onCreate }: { busy: boolean; onClose: () => void; onCreate: (name: string) => Promise<void> }) {
  const [name, setName] = useState("");
  return (
    <Modal onClose={onClose} busy={busy} labelledBy="new-drop-title">
      <p id="new-drop-title" className="font-semibold" style={{ color: "var(--text-primary)" }}>New drop</p>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => { e.preventDefault(); if (name.trim()) void onCreate(name).catch(() => {}); }}
      >
        <input autoFocus value={name} maxLength={50} onChange={(e) => setName(e.target.value)} placeholder="Diwali" className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
        <p className="text-xs -mt-1" style={{ color: "var(--text-muted)" }}>Shown as “{dropTitle(name || "Diwali")}”. It starts as a draft.</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="text-sm px-3 py-2 rounded-lg hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>Cancel</button>
          <button type="submit" disabled={busy || !name.trim()} className="text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-40" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>{busy ? "Creating…" : "Create"}</button>
        </div>
      </form>
    </Modal>
  );
}

/** Search all wallpapers; click to add to / remove from the drop (saved with the drop). */
function DropPicker({ selected, onClose, onToggle }: { selected: AdminDropItem[]; onClose: () => void; onToggle: (w: AdminWallpaper) => void }) {
  const [q, setQ] = useState("");
  const [shape, setShape] = useState<"all" | "true" | "false">("all");
  const [results, setResults] = useState<AdminWallpaper[]>([]);
  const [loading, setLoading] = useState(true);
  const chosen = useMemo(() => new Set(selected.map((s) => s.id)), [selected]);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const page = await listAdminWallpapers({ q: q.trim() || undefined, status: "approved", mobile: shape === "all" ? undefined : shape, sort: q.trim() ? "trending" : "newest", limit: 48 });
        if (alive) setResults(page.data);
      } catch {
        if (alive) setResults([]);
      } finally {
        if (alive) setLoading(false);
      }
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [q, shape]);

  return (
    <Modal onClose={onClose} width={900} labelledBy="drop-picker-title">
      <div className="flex items-center justify-between gap-3">
        <p id="drop-picker-title" className="font-semibold" style={{ color: "var(--text-primary)" }}>Add wallpapers <span className="font-normal text-sm" style={{ color: "var(--text-muted)" }}>· {selected.length} in the drop</span></p>
        <button onClick={onClose} className="text-sm font-semibold px-3 py-1.5 rounded-lg" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>Done</button>
      </div>
      <div className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="Search live wallpapers by title or tag (e.g. diwali, diya)" className="flex-1 rounded-lg px-3 py-2 text-sm" style={inputStyle} />
        <select value={shape} onChange={(e) => setShape(e.target.value as typeof shape)} className="rounded-lg px-2 py-2 text-sm" style={inputStyle} aria-label="Shape">
          <option value="all">All shapes</option>
          <option value="true">Phone</option>
          <option value="false">Desktop</option>
        </select>
      </div>
      <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 md:grid-cols-6 content-start min-h-[240px] max-h-[60vh] overflow-y-auto pr-1" style={{ opacity: loading ? 0.6 : 1 }}>
        {results.map((w) => {
          const on = chosen.has(w.id);
          return (
            <button
              key={w.id}
              onClick={() => onToggle(w)}
              aria-pressed={on}
              title={w.title}
              className="relative rounded-lg overflow-hidden aspect-[9/16]"
              style={{ background: w.dominantColor, outline: on ? "2px solid var(--accent)" : "1px solid var(--border)", outlineOffset: on ? 2 : 0 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={w.thumbUrl ?? w.fileUrl} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 p-1.5 text-[11px] text-left truncate" style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.85))", color: "#fff" }}>{w.title}</span>
              {on && <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>✓</span>}
              {!w.isMobile && <span className="absolute top-1.5 left-1.5 text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(0,0,0,0.7)", color: "#ddd" }}>Desktop</span>}
            </button>
          );
        })}
        {!loading && results.length === 0 && <p className="col-span-full text-sm text-center py-10" style={{ color: "var(--text-muted)" }}>No live wallpapers match.</p>}
      </div>
    </Modal>
  );
}
