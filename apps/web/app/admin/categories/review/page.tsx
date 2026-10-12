"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  applyCategorySuggestions,
  dismissCategorySuggestions,
  getCategoryOptions,
  getCategorySuggestions,
  revalidateSite,
  type CategoryOption,
  type CategorySuggestion,
  type SuggestionKind,
  type SuggestionPage,
} from "@/lib/adminApi";
import { useToast } from "@/lib/toast";
import { inputStyle } from "../../_components/ui";
import WallpaperLightbox, { type LightboxWallpaper } from "../../_components/WallpaperLightbox";

const TABS: { kind: SuggestionKind; label: string; hint: string }[] = [
  { kind: "uncategorized", label: "Uncategorized", hint: "Wallpapers with no real category. The AI wasn't sure enough to file these automatically." },
  { kind: "moves", label: "Probably in the wrong category", hint: "The AI thinks the current category is clearly wrong. Applying moves them; dismissing keeps them where they are." },
];
const NONE = "__none__";

export default function CategoryReviewPage() {
  const { toast } = useToast();
  const [kind, setKind] = useState<SuggestionKind>("uncategorized");
  const [page, setPage] = useState<SuggestionPage | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [error, setError] = useState("");
  /** chosen target per wallpaper (defaults to the AI's suggestion) */
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<LightboxWallpaper | null>(null);

  useEffect(() => {
    getCategoryOptions()
      .then((c) => setCategories(c.filter((x) => x.slug !== "uncategorized")))
      .catch(() => toast("Couldn't load categories", "error"));
  }, [toast]);

  const load = useCallback(async (k: SuggestionKind) => {
    setError("");
    setPage(null);
    try {
      const p = await getCategorySuggestions(k);
      setPage(p);
      setChoice(Object.fromEntries(p.data.map((s) => [s.wallpaperId, s.suggested?.id ?? NONE])));
      setSelected(new Set(p.data.filter((s) => s.suggested).map((s) => s.wallpaperId)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);
  useEffect(() => { void load(kind); }, [kind, load]);

  /** group by the currently chosen target so the grid reads "→ Anime (34)" */
  const groups = useMemo(() => {
    if (!page) return [];
    const nameOf = new Map(categories.map((c) => [c.id, c.name]));
    const m = new Map<string, CategorySuggestion[]>();
    for (const s of page.data) {
      const key = choice[s.wallpaperId] ?? NONE;
      m.set(key, [...(m.get(key) ?? []), s]);
    }
    return [...m.entries()]
      .map(([id, items]) => ({ id, name: id === NONE ? "No good fit — choose one" : nameOf.get(id) ?? "Unknown", items }))
      .sort((a, b) => (a.id === NONE ? 1 : b.id === NONE ? -1 : b.items.length - a.items.length));
  }, [page, choice, categories]);

  const selectedApplicable = useMemo(
    () => (page?.data ?? []).filter((s) => selected.has(s.wallpaperId) && choice[s.wallpaperId] && choice[s.wallpaperId] !== NONE),
    [page, selected, choice]
  );

  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleGroup = (ids: string[], on: boolean) => setSelected((prev) => { const n = new Set(prev); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; });

  const apply = async () => {
    setBusy(true);
    try {
      let applied = 0;
      const items = selectedApplicable.map((s) => ({ wallpaperId: s.wallpaperId, categoryId: choice[s.wallpaperId]! }));
      for (let i = 0; i < items.length; i += 500) applied += (await applyCategorySuggestions(items.slice(i, i + 500))).applied;
      const ok = await revalidateSite(["categories", "wallpapers"]);
      toast(`Moved ${applied} wallpaper${applied === 1 ? "" : "s"}${ok ? " — site updated." : "."}`, "success");
      await load(kind);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to apply", "error");
    } finally {
      setBusy(false);
    }
  };

  const dismiss = async () => {
    const ids = (page?.data ?? []).filter((s) => selected.has(s.wallpaperId)).map((s) => s.wallpaperId);
    if (!ids.length) return;
    setBusy(true);
    try {
      const r = await dismissCategorySuggestions(ids);
      toast(`Dismissed ${r.dismissed} — ${kind === "moves" ? "they stay where they are" : "they stay uncategorized"}.`, "success");
      await load(kind);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to dismiss", "error");
    } finally {
      setBusy(false);
    }
  };

  const tab = TABS.find((t) => t.kind === kind)!;
  const noneSelected = (page?.data ?? []).filter((s) => selected.has(s.wallpaperId) && (choice[s.wallpaperId] ?? NONE) === NONE).length;

  return (
    <div className="pb-28">
      <Link href="/admin/categories" className="text-xs" style={{ color: "var(--text-muted)" }}>← Categories</Link>
      <h1 className="text-2xl font-bold mt-1" style={{ color: "var(--text-primary)" }}>AI category suggestions</h1>
      <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
        Untick anything that looks wrong, or pick a different category from the card&apos;s menu, then apply.
      </p>

      <div className="mt-5 flex flex-wrap gap-2" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.kind}
            role="tab"
            aria-selected={kind === t.kind}
            onClick={() => setKind(t.kind)}
            disabled={busy}
            className="text-sm px-3 py-1.5 rounded-lg"
            style={{
              background: kind === t.kind ? "rgba(129,238,78,0.12)" : "transparent",
              border: `1px solid ${kind === t.kind ? "rgba(129,238,78,0.4)" : "var(--border)"}`,
              color: kind === t.kind ? "var(--text-primary)" : "var(--text-secondary)",
            }}
          >
            {t.label}
            {page && <span className="ml-2 tabular-nums" style={{ color: "var(--text-muted)" }}>{page.counts[t.kind]}</span>}
          </button>
        ))}
      </div>
      <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>{tab.hint}</p>

      {error && <p className="mt-6 text-sm" style={{ color: "#ef4444" }}>{error}</p>}
      {!page && !error && <div className="mt-6 h-40 rounded-xl animate-pulse" style={{ background: "var(--bg-secondary)" }} />}
      {page && page.data.length === 0 && (
        <div className="mt-10 text-center">
          <p className="font-semibold" style={{ color: "var(--text-primary)" }}>All done here</p>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>No pending suggestions in this list.</p>
        </div>
      )}

      {groups.map((g) => {
        const ids = g.items.map((s) => s.wallpaperId);
        const allOn = ids.every((id) => selected.has(id));
        return (
          <section key={g.id} className="mt-6">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-sm font-semibold" style={{ color: g.id === NONE ? "#f59e0b" : "var(--text-primary)" }}>
                {g.id === NONE ? g.name : `→ ${g.name}`} <span className="font-normal tabular-nums" style={{ color: "var(--text-muted)" }}>({g.items.length})</span>
              </h2>
              <button onClick={() => toggleGroup(ids, !allOn)} disabled={busy} className="text-xs underline" style={{ color: "var(--text-secondary)" }}>
                {allOn ? "Untick all" : "Tick all"}
              </button>
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}>
              {g.items.map((s) => {
                const on = selected.has(s.wallpaperId);
                return (
                  <div
                    key={s.wallpaperId}
                    className="rounded-lg overflow-hidden flex flex-col"
                    style={{ background: "var(--bg-secondary)", border: `1px solid ${on ? "rgba(129,238,78,0.45)" : "var(--border)"}`, opacity: on ? 1 : 0.55 }}
                  >
                    <div className="relative" style={{ aspectRatio: "16 / 10", background: s.dominantColor }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={s.fileUrl}
                        alt={s.title}
                        loading="lazy"
                        onClick={() => setPreview({ fileUrl: s.fileUrl, title: s.title, width: s.width, height: s.height, format: "", tags: [], dominantColor: s.dominantColor })}
                        className="absolute inset-0 w-full h-full object-cover cursor-zoom-in"
                      />
                      <label className="absolute top-1.5 left-1.5 w-6 h-6 rounded flex items-center justify-center cursor-pointer" style={{ background: "rgba(0,0,0,0.6)" }}>
                        <input type="checkbox" checked={on} disabled={busy} onChange={() => toggle(s.wallpaperId)} aria-label={`Include ${s.title}`} className="w-4 h-4 accent-[#81ee4e]" />
                      </label>
                    </div>
                    <div className="p-2 flex flex-col gap-1.5">
                      <p className="text-xs truncate" style={{ color: "var(--text-primary)" }} title={s.title}>{s.title}</p>
                      {s.current && <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>now in <b>{s.current.name}</b></p>}
                      <select
                        aria-label={`Category for ${s.title}`}
                        value={choice[s.wallpaperId] ?? NONE}
                        disabled={busy}
                        onChange={(e) => {
                          const v = e.target.value;
                          setChoice((c) => ({ ...c, [s.wallpaperId]: v }));
                          if (v !== NONE) setSelected((prev) => new Set(prev).add(s.wallpaperId));
                        }}
                        className="rounded-md px-2 py-1 text-xs"
                        style={inputStyle}
                      >
                        <option value={NONE}>Choose…</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}{c.id === s.suggested?.id ? " (AI)" : c.id === s.alternative?.id ? " (AI 2nd)" : ""}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] leading-snug" style={{ color: "var(--text-muted)" }} title={s.reason ?? ""}>
                        {s.reason}
                        {s.newCategoryIdea ? ` · idea: “${s.newCategoryIdea}”` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {page && page.data.length > 0 && (
        <div className="fixed bottom-4 left-0 right-0 md:left-60 z-30 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-hover)", boxShadow: "0 16px 48px rgba(0,0,0,0.5)" }}>
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>
              {selected.size} selected
              {noneSelected > 0 && <span className="text-xs ml-2" style={{ color: "#f59e0b" }}>({noneSelected} need a category)</span>}
            </span>
            <button disabled={busy || selected.size === 0} onClick={dismiss} className="text-xs px-3 py-2 rounded-lg hover:bg-white/5 disabled:opacity-40" style={{ color: "var(--text-secondary)" }}>
              Dismiss selected
            </button>
            <button
              disabled={busy || selectedApplicable.length === 0}
              onClick={apply}
              className="text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-40"
              style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
            >
              {busy ? "Working…" : `Apply ${selectedApplicable.length}`}
            </button>
          </div>
        </div>
      )}

      {preview && <WallpaperLightbox wallpaper={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
