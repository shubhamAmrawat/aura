"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Logo from "@/app/components/Logo";
import { useAuth } from "@/lib/authContext";
import { getInterests, saveInterests } from "@/lib/profileApi";
import { queueToast, useToast } from "@/lib/toast";

export interface PickerCategory {
  id: string;
  slug: string;
  name: string;
  image: string;
}

/** Most categories a user can pick (the API enforces the same limit). */
const MAX = 4;

/** Only same-site paths ("/x"), never "//host" or full URLs. */
function safeNext(raw: string | null, fallback: string): string {
  if (!raw) return fallback;
  let path = raw;
  try { path = decodeURIComponent(raw); } catch { /* use as is */ }
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\") ? path : fallback;
}

export default function InterestsPicker({ categories }: { categories: PickerCategory[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();

  const editing = params.get("mode") === "edit";
  const next = safeNext(params.get("next"), editing ? "/settings" : "/");

  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Start from what the user already picked (editing from Settings, or coming back).
  useEffect(() => {
    let alive = true;
    getInterests()
      .then((list) => {
        if (!alive) return;
        const known = new Set(categories.map((c) => c.id));
        const ids = list.map((i) => i.id).filter((id) => known.has(id)).slice(0, MAX);
        if (ids.length) setPicked(ids);
      })
      .catch(() => { /* not signed in / offline → start empty */ });
    return () => { alive = false; };
  }, [categories]);

  const full = picked.length >= MAX;
  const byId = new Map(categories.map((c) => [c.id, c]));

  const toggle = (id: string) =>
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < MAX ? [...cur, id] : cur));

  const leave = () => { setLeaving(true); router.replace(next); };

  async function save() {
    if (!picked.length || saving) return;
    setSaving(true);
    try {
      await saveInterests(picked);
      queueToast(editing ? "Interests updated" : "You're all set — enjoy your feed", "success");
      leave();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save your picks. Try again.", "error");
      setSaving(false);
    }
  }

  const firstName = user?.displayName?.trim().split(/\s+/)[0];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <header className="flex items-center justify-between gap-4 px-5 sm:px-12 py-4 sm:py-5">
        <Logo href={null} />
        {!editing && (
          <div className="hidden sm:flex items-center gap-3 w-[260px]" aria-label="Last step of sign-up">
            <div className="flex-1 grid grid-cols-4 gap-1.5" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => <span key={i} className="h-[3px] rounded-full" style={{ background: "var(--accent)" }} />)}
            </div>
            <span className="text-xs whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Last step</span>
          </div>
        )}
        <button
          type="button"
          onClick={leave}
          disabled={leaving}
          className="min-h-11 px-1 text-sm transition-colors hover:text-white disabled:opacity-50"
          style={{ color: "var(--text-secondary)" }}
        >
          {editing ? "Cancel" : "Skip for now"}
        </button>
      </header>

      <main className="flex-1 w-full max-w-[1200px] mx-auto px-5 sm:px-12 pt-4 sm:pt-6 pb-40">
        <p className="mb-3 text-xs tracking-[0.18em] uppercase" style={{ color: "var(--accent)" }}>
          {editing ? "Your feed" : firstName ? `Welcome, ${firstName}` : "Welcome to Aurora"}
        </p>
        <h1 className="text-[40px] sm:text-[56px] leading-[1.02]" style={{ fontFamily: "var(--font-serif), serif" }}>
          {editing ? "Your interests" : "What do you love looking at?"}
        </h1>
        <p className="mt-3.5 mb-8 sm:mb-9 text-[15px] sm:text-base leading-relaxed max-w-[620px]" style={{ color: "var(--text-secondary)" }}>
          Pick up to {MAX}. We’ll use them to shape your home feed{editing ? "." : ", and you can change them any time in Settings."}
        </p>

        {categories.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Categories couldn’t be loaded right now. You can pick them later in Settings.</p>
        ) : (
          <div role="group" aria-label="Categories" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {categories.map((c) => {
              const on = picked.includes(c.id);
              const dim = full && !on;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  aria-disabled={dim || undefined}
                  onClick={() => toggle(c.id)}
                  className="group relative aspect-[16/10] rounded-[18px] overflow-hidden transition-[transform,box-shadow,opacity] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                  style={{
                    background: "#151515",
                    boxShadow: on ? "0 0 0 3px var(--accent), 0 18px 40px rgba(0,0,0,0.45)" : "none",
                    transform: on ? "scale(0.97)" : "none",
                    opacity: dim ? 0.4 : 1,
                    cursor: dim ? "not-allowed" : "pointer",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.image} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <span aria-hidden="true" className="absolute inset-0" style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.7), rgba(0,0,0,0.08) 60%)" }} />
                  <span className="absolute left-3.5 sm:left-4 bottom-3 sm:bottom-3.5 text-[15px] sm:text-lg font-semibold text-white" style={{ textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>
                    {c.name}
                  </span>
                  {on && (
                    <span
                      aria-hidden="true"
                      className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 w-7 h-7 sm:w-[30px] sm:h-[30px] rounded-full flex items-center justify-center text-[13px] sm:text-sm font-bold"
                      style={{ background: "var(--accent)", color: "#0a0a0a", boxShadow: "0 4px 14px rgba(0,0,0,0.4)" }}
                    >
                      {picked.indexOf(c.id) + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/[0.08] backdrop-blur-xl" style={{ background: "rgba(10,10,10,0.88)" }}>
        <div className="max-w-[1200px] mx-auto px-5 sm:px-12 py-3.5 sm:py-4 flex items-center gap-4">
          <div className="flex-1 min-w-0 flex items-center gap-2 overflow-hidden">
            <div className="hidden md:flex items-center gap-2 min-w-0">
              {picked.map((id) => {
                const c = byId.get(id);
                if (!c) return null;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggle(id)}
                    aria-label={`Remove ${c.name}`}
                    className="h-10 pl-1 pr-3 rounded-full flex items-center gap-2 text-sm font-medium shrink-0 transition-colors hover:bg-white/[0.06]"
                    style={{ border: "1px solid rgba(255,255,255,0.12)", background: "#161616" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.image} alt="" className="w-8 h-8 rounded-full object-cover" />
                    {c.name}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                  </button>
                );
              })}
            </div>
            <span className="text-sm whitespace-nowrap md:ml-1" style={{ color: "var(--text-muted)" }} aria-live="polite">
              {picked.length === 0 ? `Pick up to ${MAX}` : `${picked.length} of ${MAX}`}
            </span>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={!picked.length || saving || leaving}
            className="h-12 sm:h-[52px] px-6 sm:px-7 rounded-full flex items-center gap-2.5 text-[15px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "var(--accent)", color: "#0a0a0a" }}
          >
            {saving ? "Saving…" : editing ? "Save interests" : "Show me my feed"}
            {!saving && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
