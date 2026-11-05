"use client";

import { useEffect, useState } from "react";
import { ShuffleIcon, UploadIcon, XIcon } from "lucide-react";
import { packAvatarPreview, setPackAvatar, type AvatarStyle } from "@/lib/profileApi";

const PACKS: { key: AvatarStyle; label: string }[] = [
  { key: "critter", label: "Night critters" },
  { key: "celestial", label: "Celestials" },
  { key: "face", label: "Faces" },
];
const COUNT = 12;

function randomSeeds(n: number) {
  const a = new Uint32Array(n);
  crypto.getRandomValues(a);
  return Array.from(a);
}

/** Profile › choose an avatar from Aurora's pack (three styles), or upload a photo instead. */
export default function AvatarPicker({ onClose, onSaved, onUploadPhoto }: {
  onClose: () => void;
  onSaved: (avatarUrl: string) => void;
  onUploadPhoto: () => void;
}) {
  const [style, setStyle] = useState<AvatarStyle>("critter");
  const [seeds, setSeeds] = useState<number[]>(() => randomSeeds(COUNT));
  const [picked, setPicked] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !saving && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const shuffle = () => {
    setSeeds(randomSeeds(COUNT));
    setPicked(null);
  };
  const choose = (s: AvatarStyle) => {
    setStyle(s);
    setPicked(null);
  };
  const shown = picked ?? seeds[0]!;

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
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => !saving && onClose()} role="dialog" aria-modal="true" aria-labelledby="avatar-picker-title">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[min(560px,100%)] max-h-[92vh] overflow-y-auto rounded-3xl p-6 flex flex-col gap-5"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-hover)", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
      >
        <div className="flex items-center">
          <h2 id="avatar-picker-title" className="flex-1 text-[22px]" style={{ fontFamily: "var(--font-serif), serif", color: "var(--text-primary)" }}>Choose your avatar</h2>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>
            <XIcon size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={packAvatarPreview(style, shown, 256)} alt="Your new avatar" width={112} height={112} className="w-28 h-28 rounded-full" style={{ background: "var(--bg-secondary)" }} />
          <div className="flex flex-col gap-3 min-w-0">
            <div role="tablist" aria-label="Avatar style" className="inline-flex flex-wrap gap-1 p-1 rounded-xl" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
              {PACKS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  role="tab"
                  aria-selected={style === p.key}
                  onClick={() => choose(p.key)}
                  className="px-3.5 py-1.5 rounded-lg text-[13px] font-semibold"
                  style={style === p.key ? { background: "var(--accent)", color: "var(--bg-primary)" } : { color: "var(--text-secondary)" }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={shuffle} className="h-9 px-4 rounded-full text-[13px] font-bold flex items-center gap-2 hover:bg-white/10" style={{ background: "rgba(255,255,255,0.08)", color: "var(--text-primary)" }}>
                <ShuffleIcon size={14} aria-hidden="true" /> Shuffle
              </button>
              <button type="button" onClick={onUploadPhoto} disabled={saving} className="h-9 px-4 rounded-full text-[13px] font-bold flex items-center gap-2 hover:bg-white/5" style={{ border: "1px solid var(--border-hover)", color: "var(--text-primary)" }}>
                <UploadIcon size={14} aria-hidden="true" /> Upload a photo
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-6 gap-3" role="radiogroup" aria-label="Avatars">
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
                className="aspect-square rounded-full transition-transform hover:scale-105"
                style={{ boxShadow: on ? "0 0 0 3px var(--accent)" : "none", background: "var(--bg-secondary)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={packAvatarPreview(style, seed, 160)} alt="" loading="lazy" className="w-full h-full rounded-full" />
              </button>
            );
          })}
        </div>

        {error && <p className="text-sm" style={{ color: "#ef4444" }}>{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="h-11 px-5 rounded-full text-sm font-semibold hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>Cancel</button>
          <button type="button" onClick={() => void save()} disabled={saving} className="h-11 px-6 rounded-full text-sm font-extrabold disabled:opacity-60" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>
            {saving ? "Saving…" : "Use this avatar"}
          </button>
        </div>
      </div>
    </div>
  );
}
