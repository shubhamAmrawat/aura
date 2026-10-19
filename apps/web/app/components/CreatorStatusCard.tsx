"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CreatorStatus } from "@/lib/creatorApi";

/** "18 h 24 min" until `iso` (never below 1 min). */
export function timeUntil(iso: string, now = Date.now()): string {
  const mins = Math.max(1, Math.ceil((new Date(iso).getTime() - now) / 60_000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });

const Pill = ({ tone, children }: { tone: "review" | "no" | "neutral" | "good"; children: React.ReactNode }) => {
  const styles = {
    review: { background: "rgba(250,204,21,0.12)", color: "#facc15" },
    no: { background: "rgba(248,113,113,0.12)", color: "#f87171" },
    neutral: { background: "rgba(255,255,255,0.06)", color: "#cfcfcf" },
    good: { background: "var(--accent-muted)", color: "var(--accent)" },
  }[tone];
  return (
    <span className="self-start h-[26px] px-2.5 rounded-full text-xs font-medium inline-flex items-center gap-1.5" style={styles}>
      {tone === "review" && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#facc15" }} />}
      {children}
    </span>
  );
};

const serif = { fontFamily: "var(--font-serif), serif" };
const card = "rounded-3xl p-7 sm:p-9 flex flex-col gap-5";
const cardStyle = { background: "var(--bg-elevated)", border: "1px solid var(--border)" };
const primary = "self-start h-11 px-6 rounded-full text-sm font-semibold inline-flex items-center gap-2 transition-opacity hover:opacity-90";

/**
 * Where a non-creator stands in the creator program: invite to apply, in review, not approved, or paused.
 * Used on the profile's Uploads tab and on /creator/apply.
 */
export default function CreatorStatusCard({ status, onPauseEnd }: { status: CreatorStatus; onPauseEnd?: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const paused = !!status.nextApplyAt;

  useEffect(() => {
    if (!status.nextApplyAt) return;
    const t = setInterval(() => {
      setNow(Date.now());
      if (new Date(status.nextApplyAt!).getTime() <= Date.now()) onPauseEnd?.();
    }, 30_000);
    return () => clearInterval(t);
  }, [status.nextApplyAt, onPauseEnd]);

  const app = status.application;

  if (app?.status === "pending") {
    return (
      <section className={`${card} sm:flex-row sm:items-center sm:gap-9`} style={cardStyle} aria-live="polite">
        <div className="flex shrink-0 pl-2" aria-hidden="true">
          {app.samples.slice(0, 4).map((s, i, all) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={s.id}
              src={s.thumbUrl}
              alt=""
              className="w-[68px] h-[120px] object-cover rounded-xl"
              style={{
                border: "3px solid var(--bg-elevated)",
                marginLeft: i ? -22 : 0,
                transform: `rotate(${(i - (all.length - 1) / 2) * 4}deg)`,
              }}
            />
          ))}
        </div>
        <div className="flex flex-col gap-2.5 min-w-0">
          <Pill tone="review">In review</Pill>
          <h2 className="text-[30px] sm:text-[34px] leading-tight" style={serif}>Your application is with our team</h2>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Sent {day(app.createdAt)} with {app.samples.length} wallpapers. Reviews usually take up to 2 days — we’ll email you either way.
          </p>
        </div>
      </section>
    );
  }

  if (paused) {
    return (
      <section className={card} style={cardStyle}>
        <Pill tone="neutral">{status.rejections} applications not approved</Pill>
        <h2 className="text-[30px] sm:text-[34px] leading-tight" style={serif}>Take a day, then try again</h2>
        <p className="text-[15px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          You can apply again in <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{timeUntil(status.nextApplyAt!, now)}</span>.
          Use the time to pick your strongest, sharpest originals.
        </p>
        {app?.note && <TeamNote note={app.note} label="Last note from the Aurora team" />}
        <span className="self-start h-11 px-6 rounded-full text-sm font-medium inline-flex items-center" style={{ border: "1px solid var(--border-hover)", color: "var(--text-muted)" }}>
          Apply again · {when(status.nextApplyAt!)}
        </span>
      </section>
    );
  }

  if (app?.status === "rejected") {
    const tries = status.triesBeforePause;
    return (
      <section className={card} style={cardStyle}>
        <Pill tone="no">Not approved yet</Pill>
        <h2 className="text-[30px] sm:text-[34px] leading-tight" style={serif}>Not quite there — try again</h2>
        {app.note && <TeamNote note={app.note} label="Note from the Aurora team" />}
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/creator/apply" className={primary} style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>
            Apply again
          </Link>
          <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>
            {tries === 1 ? "Last try before a 1-day pause" : `${tries} more tries before a 1-day pause`}
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl p-7 sm:p-10 flex flex-wrap items-center justify-between gap-6" style={cardStyle}>
      <div className="max-w-xl flex flex-col gap-2">
        <h2 className="text-[30px] sm:text-[32px] leading-tight" style={serif}>Share your own wallpapers</h2>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Apply to the creator program with {status.rules.minSamples}–{status.rules.maxSamples} of your best wallpapers. Once approved you can publish to Aurora and get a creator badge.
        </p>
      </div>
      <Link href="/creator/apply" className={primary} style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>
        Apply to become a creator
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </Link>
    </section>
  );
}

function TeamNote({ note, label }: { note: string; label: string }) {
  return (
    <div className="rounded-2xl px-5 py-4 flex flex-col gap-1.5" style={{ background: "rgba(0,0,0,0.28)" }}>
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
      <p className="text-[15px] leading-relaxed whitespace-pre-line">{note}</p>
    </div>
  );
}
