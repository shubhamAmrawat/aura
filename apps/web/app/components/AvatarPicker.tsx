"use client";

import { useEffect, useState } from "react";
import { CheckIcon, ShuffleIcon, UploadIcon, XIcon } from "lucide-react";
import { FALLBACK_PACKS, getAvatarPacks, packAvatarPreview, setPackAvatar, type AvatarPack, type AvatarStyle } from "@/lib/profileApi";

const COUNT = 12;

function randomSeeds(n: number) {
  const a = new Uint32Array(n);
  crypto.getRandomValues(a);
  return Array.from(a);
}

/** Profile › choose an avatar from Aurora's packs (the list comes from the API), or upload a photo instead. */
export default function AvatarPicker({ onClose, onSaved, onUploadPhoto }: {
  onClose: () => void;
  onSaved: (avatarUrl: string) => void;
  onUploadPhoto: () => void;
}) {
  const [packs, setPacks] = useState<AvatarPack[]>(FALLBACK_PACKS);
  const [style, setStyle] = useState<AvatarStyle>(FALLBACK_PACKS[0]!.key);
  const [seeds, setSeeds] = useState<number[]>(() => randomSeeds(COUNT));
  const [picked, setPicked] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getAvatarPacks().then(setPacks).catch(() => undefined);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !saving && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const shuffle = () => {
    setSeeds(randomSeeds(COUNT));
    setPicked(null);
  };
  const choose = (s: AvatarStyle, el: HTMLElement) => {
    setStyle(s);
    setPicked(null);
    el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  };
  const shown = picked ?? seeds[0]!;
  const packLabel = packs.find((p) => p.key === style)?.label ?? "";

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      onSaved(await setPackAvatar(style, shown));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your avatar.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => !saving && onClose()} role="dialog" aria-modal="true" aria-labelledby="avatar-picker-title">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:w-[min(680px,100%)] max-h-[92vh] flex flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-hover)", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
      >
        {/* header */}
        <div className="flex items-center gap-3 px-6 pt-5 pb-4">
          <h2 id="avatar-picker-title" className="flex-1 text-[24px] leading-none" style={{ fontFamily: "var(--font-serif), serif", color: "var(--text-primary)" }}>Choose your avatar</h2>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="w-9 h-9 -mr-2 rounded-full flex items-center justify-center hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>
            <XIcon size={18} aria-hidden="true" />
          </button>
        </div>

        {/* packs: one row that scrolls sideways */}
        <div className="relative">
          <div role="tablist" aria-label="Avatar packs" className="flex gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {packs.map((p) => {
              const on = style === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={(e) => choose(p.key, e.currentTarget)}
                  className="shrink-0 h-9 px-4 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors"
                  style={on ? { background: "var(--accent)", color: "var(--bg-primary)" } : { border: "1px solid var(--border-hover)", color: "var(--text-secondary)" }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <span aria-hidden="true" className="pointer-events-none absolute right-0 top-0 bottom-1 w-10" style={{ background: "linear-gradient(90deg, transparent, var(--bg-elevated))" }} />
        </div>

        {/* body: preview | options */}
        <div className="flex-1 overflow-y-auto px-6 pt-5 pb-2">
          <div className="flex flex-col sm:flex-row gap-6 sm:items-start">
            <div className="flex sm:flex-col items-center gap-4 sm:w-[168px] shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={packAvatarPreview(style, shown, 320)} alt="Your new avatar" className="w-24 h-24 sm:w-[168px] sm:h-[168px] rounded-full shrink-0" style={{ background: "var(--bg-secondary)", boxShadow: "0 0 0 4px var(--bg-elevated), 0 0 0 5px var(--border-hover)" }} />
              <div className="flex flex-col gap-1 sm:items-center min-w-0">
                <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{packLabel}</span>
                <button type="button" onClick={shuffle} className="self-start sm:self-center h-9 px-4 rounded-full text-[13px] font-bold flex items-center gap-2 hover:bg-white/10" style={{ background: "rgba(255,255,255,0.07)", color: "var(--text-primary)" }}>
                  <ShuffleIcon size={14} aria-hidden="true" /> Shuffle
                </button>
              </div>
            </div>

            <div className="flex-1 grid grid-cols-4 gap-3" role="radiogroup" aria-label={`${packLabel} avatars`}>
              {seeds.map((seed) => {
                const on = seed === shown;
                return (
                  <button
                    key={`${style}-${seed}`}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label="Avatar option"
                    onClick={() => setPicked(seed)}
                    className="relative aspect-square rounded-full p-[3px] transition-transform hover:scale-[1.04]"
                    style={{ background: on ? "var(--accent)" : "transparent" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={packAvatarPreview(style, seed, 160)} alt="" loading="lazy" className="w-full h-full rounded-full" style={{ background: "var(--bg-secondary)" }} />
                    {on && (
                      <span className="absolute right-0 bottom-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "var(--accent)", color: "var(--bg-primary)", border: "2px solid var(--bg-elevated)" }}>
                        <CheckIcon size={13} strokeWidth={3} aria-hidden="true" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          {error && <p className="mt-4 text-sm" style={{ color: "#ef4444" }}>{error}</p>}
        </div>

        {/* footer */}
        <div className="flex flex-wrap items-center gap-2 px-6 py-4 mt-2" style={{ borderTop: "1px solid var(--border)" }}>
          <button type="button" onClick={onUploadPhoto} disabled={saving} className="h-10 px-3 -ml-3 rounded-full text-[13px] font-semibold flex items-center gap-2 hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>
            <UploadIcon size={15} aria-hidden="true" /> Upload a photo instead
          </button>
          <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
            <button type="button" onClick={onClose} disabled={saving} className="h-11 px-5 rounded-full text-sm font-semibold hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>Cancel</button>
            <button type="button" onClick={() => void save()} disabled={saving} className="flex-1 sm:flex-none h-11 px-6 rounded-full text-sm font-extrabold disabled:opacity-60" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>
              {saving ? "Saving…" : "Use this avatar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
