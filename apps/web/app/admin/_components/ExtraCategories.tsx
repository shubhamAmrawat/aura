"use client";

import type { CategoryOption } from "@/lib/adminApi";
import { inputStyle } from "./ui";
import { XIcon } from "lucide-react";

/** A wallpaper's main category plus up to this many extras. */
export const MAX_EXTRA_CATEGORIES = 2;

/**
 * Extra categories as removable chips + an "Also in…" picker. The main category and the
 * ones already chosen aren't offered; the picker disappears once 2 are chosen.
 */
export default function ExtraCategories({ value, primaryId, categories, aiIds = [], disabled, onChange, compact }: {
  value: string[];
  primaryId: string | null;
  categories: CategoryOption[];
  /** ids the AI suggested — shown with ✨ */
  aiIds?: string[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  /** smaller, for the bulk upload rows */
  compact?: boolean;
}) {
  const chosen = value.filter((id) => id !== primaryId);
  const name = (id: string) => categories.find((c) => c.id === id)?.name ?? "Unknown";
  const options = categories.filter((c) => c.id !== primaryId && !chosen.includes(c.id));
  const text = compact ? "text-[11px]" : "text-xs";

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${text}`}>
      {chosen.map((id) => (
        <span key={id} className="inline-flex items-center gap-1 rounded-full pl-2.5 pr-1 py-0.5" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-hover)", color: "var(--text-primary)" }}>
          {name(id)}{aiIds.includes(id) ? " ✨" : ""}
          {!disabled && (
            <button type="button" aria-label={`Remove ${name(id)}`} onClick={() => onChange(chosen.filter((x) => x !== id))} className="rounded-full p-0.5 hover:bg-white/10" style={{ color: "var(--text-muted)" }}>
              <XIcon size={10} strokeWidth={2.5} aria-hidden="true" />
            </button>
          )}
        </span>
      ))}
      {!disabled && chosen.length < MAX_EXTRA_CATEGORIES && (
        <select
          aria-label="Also show in another category"
          value=""
          onChange={(e) => e.target.value && onChange([...chosen, e.target.value])}
          className={`rounded-full px-2 py-0.5 ${text}`}
          style={{ ...inputStyle, color: "var(--text-secondary)" }}
        >
          <option value="">{chosen.length ? "+ Also in…" : "+ Also show in…"}</option>
          {options.map((c) => <option key={c.id} value={c.id}>{c.name}{aiIds.includes(c.id) ? " ✨" : ""}</option>)}
        </select>
      )}
      {disabled && chosen.length === 0 && <span style={{ color: "var(--text-muted)" }}>No extra categories</span>}
    </div>
  );
}
