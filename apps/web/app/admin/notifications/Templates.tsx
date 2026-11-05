"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createNotifyTemplate,
  deleteNotifyTemplate,
  listNotifyTemplates,
  resetNotifyTemplate,
  updateNotifyTemplate,
  type NotifyAction,
  type NotifyAudience,
  type NotifyTemplate,
  type NotifyTemplateInput,
  type TemplateCategory,
  type TemplateImageSource,
} from "@/lib/adminApi";
import { useAuth } from "@/lib/authContext";
import { useToast } from "@/lib/toast";
import { ConfirmDialog, inputStyle } from "../_components/ui";

export const CATEGORIES: { key: TemplateCategory; label: string; bg: string; fg: string }[] = [
  { key: "reengage", label: "Re-engagement", bg: "rgba(255,154,60,.14)", fg: "#FFB66B" },
  { key: "growth", label: "Growth", bg: "rgba(129,238,78,.12)", fg: "#81EE4E" },
  { key: "promotion", label: "Promotion", bg: "rgba(248,113,113,.14)", fg: "#F87171" },
  { key: "seasonal", label: "Seasonal", bg: "rgba(250,204,21,.14)", fg: "#FACC15" },
  { key: "info", label: "Information", bg: "rgba(147,197,253,.14)", fg: "#93C5FD" },
  { key: "creators", label: "Creators", bg: "rgba(196,181,253,.16)", fg: "#C4B5FD" },
];
const catOf = (k: TemplateCategory) => CATEGORIES.find((c) => c.key === k) ?? CATEGORIES[0]!;

/** Placeholders: [token, what it becomes]. */
const PLACEHOLDERS: [string, string][] = [
  ["name", "Their first name (“there” if signed out)"],
  ["count", "New wallpapers (or the drop's count)"],
  ["drop", "The live drop's name"],
  ["ends", "When the drop ends"],
  ["wallpaper", "This week's most-downloaded wallpaper"],
  ["version", "The latest app version"],
  ["festival", "You type it when sending"],
  ["category", "You type it when sending"],
  ["downloads", "Their wallpapers' downloads this week"],
  ["likes", "Their wallpapers' likes this week"],
];
/** Sample values for the preview. */
const SAMPLE: Record<string, string> = { count: "38", drop: "Diwali Drops", ends: "12 Nov", wallpaper: "Golden Diya", version: "1.0.4", festival: "Diwali", category: "Nature", downloads: "126", likes: "48" };

export function describeAudience(a: NotifyAudience) {
  const who = { everyone: "Everyone", signedIn: "Signed in", signedOut: "Signed out", creators: "Creators", users: "Picked people", devices: "Picked phones" }[a.kind];
  const extra = [
    a.activeDays ? (a.activeDays > 0 ? `active in ${a.activeDays} days` : `inactive ${-a.activeDays}+ days`) : null,
    a.installedDays ? `installed ${a.installedDays}+ days` : null,
    a.excludeCreators ? "not creators" : null,
    a.notOpenedLatestDrop ? "didn't open the drop" : null,
    a.versionBelow ? `app older than ${a.versionBelow}` : null,
  ].filter(Boolean);
  return [who, ...extra].join(" · ");
}
export const describeCooldown = (d: number) => (d ? `Once per ${d} day${d === 1 ? "" : "s"}` : "No cooldown");

const card = { background: "var(--bg-secondary)", border: "1px solid var(--border)" };
const label = "flex flex-col gap-1.5 text-xs font-semibold";

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className="h-8 px-3 rounded-full text-[12.5px] font-bold"
      style={{ border: `1px solid ${on ? "var(--text-primary)" : "var(--border-hover)"}`, background: on ? "var(--text-primary)" : "transparent", color: on ? "var(--bg-primary)" : "var(--text-secondary)" }}
    >
      {children}
    </button>
  );
}

/** Admin › Notifications › Templates: the library, and the editor. */
export default function Templates({ onUse }: { onUse: (id: string) => void }) {
  const { toast } = useToast();
  const [list, setList] = useState<NotifyTemplate[] | null>(null);
  const [filter, setFilter] = useState<"all" | "yours" | TemplateCategory>("all");
  const [editing, setEditing] = useState<NotifyTemplate | "new" | null>(null);

  const load = useCallback(async () => {
    try {
      setList(await listNotifyTemplates());
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load templates", "error");
    }
  }, [toast]);
  useEffect(() => { void load(); }, [load]);

  if (editing) {
    return (
      <Editor
        template={editing === "new" ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={(t) => {
          setList((l) => (l ? (l.some((x) => x.id === t.id) ? l.map((x) => (x.id === t.id ? t : x)) : [...l, t]) : l));
          setEditing(t);
        }}
        onDeleted={(id) => {
          setList((l) => l?.filter((x) => x.id !== id) ?? null);
          setEditing(null);
        }}
        onUse={onUse}
      />
    );
  }

  const shown = (list ?? []).filter((t) => filter === "all" || (filter === "yours" ? !t.builtin : t.category === filter));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip on={filter === "all"} onClick={() => setFilter("all")}>All</Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c.key} on={filter === c.key} onClick={() => setFilter(c.key)}>{c.label}</Chip>
        ))}
        <Chip on={filter === "yours"} onClick={() => setFilter("yours")}>Yours</Chip>
        <span className="flex-1" />
        <button type="button" onClick={() => setEditing("new")} className="h-9 px-3.5 rounded-lg text-[13px] font-extrabold" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>
          + New template
        </button>
      </div>

      {!list ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : !shown.length ? (
        <p className="text-sm px-4 py-8 rounded-2xl text-center" style={{ ...card, color: "var(--text-muted)" }}>
          {filter === "yours" ? "No templates of your own yet. Make one with “New template”, or edit a built-in." : "Nothing here."}
        </p>
      ) : (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))" }}>
          {shown.map((t) => {
            const c = catOf(t.category);
            return (
              <article key={t.id} className="rounded-2xl p-4 flex flex-col gap-2.5" style={card}>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10.5px] font-extrabold tracking-wide" style={{ background: c.bg, color: c.fg }}>{c.label.toUpperCase()}</span>
                  <span className="ml-auto text-[11.5px]" style={{ color: "var(--text-muted)" }}>{t.builtin ? (t.modified ? "Built-in · edited" : "Built-in") : "Yours"}</span>
                </div>
                <h3 className="text-[15px] font-extrabold" style={{ color: "var(--text-primary)" }}>{t.name}</h3>
                <div className="rounded-xl px-3 py-2.5 flex flex-col gap-0.5" style={{ background: "var(--bg-primary)" }}>
                  <span className="text-[13.5px] font-bold" style={{ color: "var(--text-primary)" }}>{t.title}</span>
                  {t.body && <span className="text-[12.5px] leading-snug" style={{ color: "var(--text-secondary)" }}>{t.body}</span>}
                </div>
                <div className="flex flex-wrap gap-1.5 text-[11.5px]">
                  <span className="px-2 py-0.5 rounded-full" style={{ background: "rgba(147,197,253,.12)", color: "#93C5FD" }}>{describeAudience(t.audience)}</span>
                  <span className="px-2 py-0.5 rounded-full" style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}>{describeCooldown(t.cooldownDays)}</span>
                  {t.bestTime && <span className="px-2 py-0.5 rounded-full" style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}>{t.bestTime}</span>}
                </div>
                <div className="flex gap-2 mt-auto pt-1">
                  <button type="button" onClick={() => onUse(t.id)} className="flex-1 h-9 rounded-lg text-[13px] font-extrabold" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>Use</button>
                  <button type="button" onClick={() => setEditing(t)} className="h-9 px-3.5 rounded-lg text-[13px] font-bold hover:bg-white/5" style={{ border: "1px solid var(--border-hover)", color: "var(--text-primary)" }}>Edit</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── editor ─────────────────────────────────────────────────

type OpensKind = "inbox" | "@drop" | "@wallpaper" | "aurora://update" | "link";
const opensKindOf = (url: string | null): OpensKind => (!url ? "inbox" : url === "@drop" || url === "@wallpaper" || url === "aurora://update" ? url : "link");

const BLANK: NotifyTemplateInput = {
  category: "promotion",
  name: "",
  description: null,
  type: "announcement",
  title: "",
  body: "",
  imageSource: "none",
  imageUrl: null,
  url: null,
  actions: [],
  audience: { kind: "everyone" },
  bestTime: null,
  cooldownDays: 7,
};

function Editor({ template, onClose, onSaved, onDeleted, onUse }: {
  template: NotifyTemplate | null;
  onClose: () => void;
  onSaved: (t: NotifyTemplate) => void;
  onDeleted: (id: string) => void;
  onUse: (id: string) => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [t, setT] = useState<NotifyTemplateInput>(() => (template ? strip(template) : BLANK));
  const [linkUrl, setLinkUrl] = useState(template && opensKindOf(template.url) === "link" ? template.url ?? "" : "");
  const [asPerson, setAsPerson] = useState(true);
  const [busy, setBusy] = useState<"save" | "reset" | "delete" | null>(null);
  const [confirm, setConfirm] = useState<"reset" | "delete" | null>(null);
  const focused = useRef<"title" | "body">("title");
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const saved = useRef(JSON.stringify(template ? strip(template) : BLANK));

  const set = <K extends keyof NotifyTemplateInput>(k: K, v: NotifyTemplateInput[K]) => setT((x) => ({ ...x, [k]: v }));
  const setAud = (a: Partial<NotifyAudience>) => setT((x) => ({ ...x, audience: { ...x.audience, ...a } }));
  const opens = opensKindOf(t.url);
  const dirty = JSON.stringify(t) !== saved.current;

  const insert = (token: string) => {
    const key = focused.current;
    const el = key === "title" ? titleRef.current : bodyRef.current;
    const cur = (key === "title" ? t.title : t.body) ?? "";
    const at = el?.selectionStart ?? cur.length;
    const end = el?.selectionEnd ?? at;
    const next = cur.slice(0, at) + `{${token}}` + cur.slice(end);
    set(key, next);
    requestAnimationFrame(() => {
      el?.focus();
      const p = at + token.length + 2;
      el?.setSelectionRange(p, p);
    });
  };

  const firstName = (user?.displayName ?? "").trim().split(/\s+/)[0] || "Riya";
  const render = (s: string) =>
    s.replace(/\{([a-z]+)\}/g, (m, k: string) => (k === "name" ? (asPerson ? firstName : "there") : SAMPLE[k] ?? m));

  const save = async () => {
    setBusy("save");
    try {
      const input: NotifyTemplateInput = { ...t, name: t.name.trim(), body: t.body?.trim() || null, imageUrl: t.imageSource === "custom" ? t.imageUrl?.trim() || null : null, url: opens === "link" ? linkUrl.trim() || null : t.url };
      const r = template ? await updateNotifyTemplate(template.id, input) : await createNotifyTemplate(input);
      saved.current = JSON.stringify(strip(r));
      setT(strip(r));
      toast("Template saved.", "success");
      onSaved(r);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to save", "error");
    } finally {
      setBusy(null);
    }
  };

  const reset = async () => {
    if (!template) return;
    setBusy("reset");
    try {
      const r = await resetNotifyTemplate(template.id);
      saved.current = JSON.stringify(strip(r));
      setT(strip(r));
      setLinkUrl(opensKindOf(r.url) === "link" ? r.url ?? "" : "");
      setConfirm(null);
      toast("Back to the built-in version.", "success");
      onSaved({ ...r, modified: false });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to reset", "error");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!template) return;
    setBusy("delete");
    try {
      await deleteNotifyTemplate(template.id);
      toast("Template deleted.", "success");
      onDeleted(template.id);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete", "error");
      setBusy(null);
    }
  };

  const c = catOf(t.category);
  const activeVal = t.audience.activeDays ? String(t.audience.activeDays) : "";
  const imagePreview = t.imageSource === "custom" ? t.imageUrl : t.imageSource === "none" ? null : "sample";
  const buttons = t.actions;
  const setButtons = (b: NotifyAction[]) => set("actions", b);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onClose} className="text-sm font-semibold hover:underline" style={{ color: "var(--text-secondary)" }}>← Templates</button>
        <span className="px-2 py-0.5 rounded-full text-[10.5px] font-extrabold tracking-wide" style={{ background: c.bg, color: c.fg }}>{c.label.toUpperCase()}</span>
        <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{template ? (template.builtin ? (template.modified ? "Built-in · edited" : "Built-in") : "Yours") : "New"}</span>
        <span className="flex-1" />
        {template?.builtin && template.modified && (
          <button type="button" onClick={() => setConfirm("reset")} className="h-9 px-3 rounded-lg text-[13px] font-bold hover:bg-white/5" style={{ border: "1px solid var(--border-hover)", color: "var(--text-secondary)" }}>Reset to built-in</button>
        )}
        {template && !template.builtin && (
          <button type="button" onClick={() => setConfirm("delete")} className="h-9 px-3 rounded-lg text-[13px] font-bold hover:bg-white/5" style={{ border: "1px solid rgba(239,68,68,.35)", color: "#ef4444" }}>Delete</button>
        )}
        <button type="button" disabled={!dirty || !t.name.trim() || !t.title.trim() || busy !== null} onClick={() => void save()} className="h-9 px-4 rounded-lg text-[13px] font-extrabold disabled:opacity-40" style={{ border: "1px solid var(--border-hover)", color: "var(--text-primary)" }}>
          {busy === "save" ? "Saving…" : "Save"}
        </button>
        {template && (
          <button type="button" disabled={dirty} title={dirty ? "Save first" : undefined} onClick={() => onUse(template.id)} className="h-9 px-4 rounded-lg text-[13px] font-extrabold disabled:opacity-40" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>Use now</button>
        )}
      </div>

      <div className="flex flex-wrap gap-5 items-start">
        <div className="flex-[999_1_520px] min-w-0 flex flex-col gap-4">
          <section className="rounded-2xl p-5 flex flex-col gap-4" style={card}>
            <div className="flex flex-wrap gap-3">
              <label className={`${label} flex-[2_1_220px]`} style={{ color: "var(--text-secondary)" }}>
                Name
                <input value={t.name} maxLength={60} onChange={(e) => set("name", e.target.value)} placeholder="We miss you" className="rounded-lg px-3 py-2 text-sm font-normal" style={inputStyle} />
              </label>
              <label className={`${label} flex-[1_1_160px]`} style={{ color: "var(--text-secondary)" }}>
                Category
                <select value={t.category} onChange={(e) => set("category", e.target.value as TemplateCategory)} className="h-[38px] rounded-lg px-2 text-sm font-normal [color-scheme:dark]" style={inputStyle}>
                  {CATEGORIES.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                </select>
              </label>
              <label className={`${label} flex-[1_1_140px]`} style={{ color: "var(--text-secondary)" }}>
                Type
                <select value={t.type} onChange={(e) => set("type", e.target.value as NotifyTemplateInput["type"])} className="h-[38px] rounded-lg px-2 text-sm font-normal [color-scheme:dark]" style={inputStyle}>
                  <option value="announcement">Announcement</option>
                  <option value="update">App update</option>
                  <option value="drop">Drop</option>
                </select>
              </label>
            </div>
            <label className={label} style={{ color: "var(--text-secondary)" }}>
              Note for admins (optional)
              <input value={t.description ?? ""} maxLength={200} onChange={(e) => set("description", e.target.value || null)} placeholder="When to use it" className="rounded-lg px-3 py-2 text-sm font-normal" style={inputStyle} />
            </label>
          </section>

          <section className="rounded-2xl p-5 flex flex-col gap-4" style={card}>
            <h2 className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>Text</h2>
            <label className={label} style={{ color: "var(--text-secondary)" }}>
              <span className="flex justify-between">Title <span className="font-normal" style={{ color: "var(--text-muted)" }}>{t.title.length} / 65</span></span>
              <input ref={titleRef} value={t.title} maxLength={65} onFocus={() => (focused.current = "title")} onChange={(e) => set("title", e.target.value)} className="rounded-lg px-3 py-2 text-sm font-normal" style={inputStyle} />
            </label>
            <label className={label} style={{ color: "var(--text-secondary)" }}>
              <span className="flex justify-between">Message <span className="font-normal" style={{ color: "var(--text-muted)" }}>{(t.body ?? "").length} / 240</span></span>
              <textarea ref={bodyRef} value={t.body ?? ""} maxLength={240} rows={2} onFocus={() => (focused.current = "body")} onChange={(e) => set("body", e.target.value)} className="rounded-lg px-3 py-2 text-sm font-normal resize-none" style={inputStyle} />
            </label>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Placeholders · click to add where the cursor is</span>
              <div className="flex flex-wrap gap-1.5">
                {PLACEHOLDERS.map(([k, hint]) => (
                  <button key={k} type="button" title={hint} onMouseDown={(e) => e.preventDefault()} onClick={() => insert(k)} className="h-7 px-2.5 rounded-md text-[12px] font-mono hover:bg-white/5" style={{ border: "1px solid var(--border-hover)", color: "var(--accent)" }}>
                    {`{${k}}`}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl p-5 flex flex-col gap-4" style={card}>
            <h2 className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>Image and tap</h2>
            <div className="flex flex-wrap gap-3">
              <label className={`${label} flex-1 min-w-[220px]`} style={{ color: "var(--text-secondary)" }}>
                Image
                <select value={t.imageSource} onChange={(e) => set("imageSource", e.target.value as TemplateImageSource)} className="h-[38px] rounded-lg px-2 text-sm font-normal [color-scheme:dark]" style={inputStyle}>
                  <option value="none">None</option>
                  <option value="wallpaper">Top trending wallpaper (auto)</option>
                  <option value="drop">Live drop's first wallpaper (auto)</option>
                  <option value="custom">A fixed image link</option>
                </select>
              </label>
              <label className={`${label} flex-1 min-w-[220px]`} style={{ color: "var(--text-secondary)" }}>
                Tap opens
                <select
                  value={opens}
                  onChange={(e) => {
                    const k = e.target.value as OpensKind;
                    set("url", k === "inbox" ? null : k === "link" ? linkUrl || "/" : k);
                  }}
                  className="h-[38px] rounded-lg px-2 text-sm font-normal [color-scheme:dark]"
                  style={inputStyle}
                >
                  <option value="inbox">Notifications inbox</option>
                  <option value="@drop">The live drop</option>
                  <option value="@wallpaper">The trending wallpaper</option>
                  <option value="aurora://update">App update</option>
                  <option value="link">A link</option>
                </select>
              </label>
            </div>
            {t.imageSource === "custom" && (
              <input value={t.imageUrl ?? ""} onChange={(e) => set("imageUrl", e.target.value || null)} placeholder="https://…" aria-label="Image link" className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
            )}
            {opens === "link" && (
              <input
                value={linkUrl}
                onChange={(e) => {
                  setLinkUrl(e.target.value);
                  set("url", e.target.value || "/");
                }}
                placeholder="/category/… or https://…"
                aria-label="Link"
                className="rounded-lg px-3 py-2 text-sm"
                style={inputStyle}
              />
            )}
            <div className={label} style={{ color: "var(--text-secondary)" }}>
              Buttons (up to 2) · links can also be @drop or @wallpaper
              <div className="flex flex-col gap-2">
                {buttons.map((b, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <input value={b.label} maxLength={24} onChange={(e) => setButtons(buttons.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="Label" aria-label="Button label" className="w-40 rounded-lg px-3 py-2 text-sm font-normal" style={inputStyle} />
                    <input value={b.url} onChange={(e) => setButtons(buttons.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} placeholder="@drop, /wallpaper/… or https://…" aria-label="Button opens" className="flex-1 min-w-[180px] rounded-lg px-3 py-2 text-sm font-normal" style={inputStyle} />
                    <button type="button" onClick={() => setButtons(buttons.filter((_, j) => j !== i))} aria-label="Remove button" className="w-8 h-8 rounded-full hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>×</button>
                  </div>
                ))}
                {buttons.length < 2 && (
                  <button type="button" onClick={() => setButtons([...buttons, { id: `b${Date.now() % 100000}`, label: "", url: "" }])} className="self-start h-8 px-3 rounded-full text-xs font-semibold hover:bg-white/5" style={{ border: "1px dashed var(--border-hover)", color: "var(--text-secondary)" }}>+ Button</button>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl p-5 flex flex-col gap-4" style={card}>
            <h2 className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>Suggested audience and timing</h2>
            <div className="flex flex-wrap gap-2">
              {(["everyone", "signedIn", "signedOut", "creators"] as const).map((k) => (
                <Chip key={k} on={t.audience.kind === k} onClick={() => setAud({ kind: k })}>{{ everyone: "Everyone", signedIn: "Signed in", signedOut: "Signed out", creators: "Creators" }[k]}</Chip>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <label className={label} style={{ color: "var(--text-secondary)" }}>
                Last active
                <select value={activeVal} onChange={(e) => setAud({ activeDays: e.target.value ? Number(e.target.value) : null })} className="h-9 rounded-lg px-2 text-sm font-normal [color-scheme:dark]" style={inputStyle}>
                  <option value="">Anytime</option>
                  <option value="7">In the last 7 days</option>
                  <option value="30">In the last 30 days</option>
                  <option value="-7">Not in 7 days</option>
                  <option value="-14">Not in 14 days</option>
                  <option value="-30">Not in 30 days</option>
                </select>
              </label>
              <label className={label} style={{ color: "var(--text-secondary)" }}>
                Had the app for
                <select value={t.audience.installedDays ? String(t.audience.installedDays) : ""} onChange={(e) => setAud({ installedDays: e.target.value ? Number(e.target.value) : null })} className="h-9 rounded-lg px-2 text-sm font-normal [color-scheme:dark]" style={inputStyle}>
                  <option value="">Any time</option>
                  <option value="3">3+ days</option>
                  <option value="7">7+ days</option>
                  <option value="30">30+ days</option>
                </select>
              </label>
              <label className={label} style={{ color: "var(--text-secondary)" }}>
                Send at most
                <select value={String(t.cooldownDays)} onChange={(e) => set("cooldownDays", Number(e.target.value))} className="h-9 rounded-lg px-2 text-sm font-normal [color-scheme:dark]" style={inputStyle}>
                  {[0, 6, 7, 14, 20, 30, 60, 90].map((d) => <option key={d} value={d}>{d ? `Once per ${d} days` : "No limit"}</option>)}
                </select>
              </label>
              <label className={`${label} flex-1 min-w-[160px]`} style={{ color: "var(--text-secondary)" }}>
                Best time (a note)
                <input value={t.bestTime ?? ""} maxLength={40} onChange={(e) => set("bestTime", e.target.value || null)} placeholder="Best at 7 PM" className="h-9 rounded-lg px-3 text-sm font-normal" style={inputStyle} />
              </label>
            </div>
            <div className="flex flex-wrap gap-5 text-sm" style={{ color: "var(--text-secondary)" }}>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={!!t.audience.excludeCreators} onChange={(e) => setAud({ excludeCreators: e.target.checked || undefined })} className="w-4 h-4 accent-[var(--accent)]" />
                Leave out creators
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={!!t.audience.notOpenedLatestDrop} onChange={(e) => setAud({ notOpenedLatestDrop: e.target.checked || undefined })} className="w-4 h-4 accent-[var(--accent)]" />
                Only those who didn't open the latest drop notification
              </label>
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>You can still change all of this when sending. “Send at most” skips anyone who got this template within that many days.</p>
          </section>
        </div>

        <aside className="flex-[1_1_320px] max-w-[380px] flex flex-col gap-3 lg:sticky lg:top-6">
          <div className="rounded-3xl p-4 flex flex-col gap-2.5" style={{ background: "linear-gradient(160deg, #1b1712, #0d0d10)", border: "1px solid var(--border)" }}>
            <span className="text-[11px] font-bold tracking-wider px-1" style={{ color: "var(--text-muted)" }}>PREVIEW · {asPerson ? `AS ${firstName.toUpperCase()}` : "SIGNED OUT"}</span>
            <div className="rounded-3xl p-3 flex flex-col gap-2" style={{ background: "rgba(36,34,34,.96)" }}>
              <div className="flex items-center gap-2 text-[11.5px]" style={{ color: "#A8A49E" }}>
                <span className="w-[18px] h-[18px] rounded-full text-[10px] font-extrabold flex items-center justify-center" style={{ background: "var(--accent)", color: "#0A0A0A" }}>A</span>
                <span className="font-semibold" style={{ color: "#EDEAE6" }}>Aurora</span> · now
              </div>
              <span className="text-sm font-bold" style={{ color: "#F5F0EB" }}>{render(t.title) || "Title"}</span>
              {t.body && <span className="text-[12.5px] -mt-1" style={{ color: "#C9C5BF" }}>{render(t.body)}</span>}
              {imagePreview === "sample" ? (
                <div className="w-full h-36 rounded-2xl flex items-center justify-center text-xs" style={{ background: "linear-gradient(135deg,#3a2a14,#1a1430)", color: "#C9C5BF" }}>
                  {t.imageSource === "drop" ? "Live drop's first wallpaper" : "Trending wallpaper"}
                </div>
              ) : imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagePreview} alt="" className="w-full h-36 object-cover rounded-2xl" />
              ) : null}
              {buttons.some((b) => b.label.trim()) && (
                <div className="flex gap-1.5">
                  {buttons.filter((b) => b.label.trim()).map((b) => (
                    <span key={b.id} className="flex-1 h-8 rounded-full text-[12.5px] font-bold flex items-center justify-center" style={{ background: "rgba(255,255,255,.1)", color: "#F5F0EB" }}>{b.label}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div role="radiogroup" aria-label="Preview as" className="flex gap-2">
            <Chip on={asPerson} onClick={() => setAsPerson(true)}>As {firstName}</Chip>
            <Chip on={!asPerson} onClick={() => setAsPerson(false)}>Signed out</Chip>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Sample values shown. {"{drop}"}, {"{count}"}, {"{wallpaper}"} and {"{version}"} fill in from live data when you use it; {"{festival}"} and {"{category}"} you type in Compose; {"{name}"}, {"{downloads}"} and {"{likes}"} fill in for each person.
          </p>
        </aside>
      </div>

      {confirm && (
        <ConfirmDialog
          title={confirm === "reset" ? "Reset to the built-in version?" : "Delete this template?"}
          body={confirm === "reset" ? "Your edits to this template will be lost." : "It disappears from the library. Past sends keep their stats."}
          confirmLabel={confirm === "reset" ? "Reset" : "Delete"}
          danger={confirm === "delete"}
          busy={busy !== null}
          onCancel={() => setConfirm(null)}
          onConfirm={confirm === "reset" ? reset : remove}
        />
      )}
    </div>
  );
}

function strip(t: NotifyTemplate): NotifyTemplateInput {
  return {
    category: t.category,
    name: t.name,
    description: t.description,
    type: t.type,
    title: t.title,
    body: t.body ?? "",
    imageSource: t.imageSource,
    imageUrl: t.imageUrl,
    url: t.url,
    actions: t.actions,
    audience: t.audience,
    bestTime: t.bestTime,
    cooldownDays: t.cooldownDays,
  };
}
