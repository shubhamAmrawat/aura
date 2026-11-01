"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BellIcon } from "lucide-react";
import { useAuth } from "@/lib/authContext";
import { useDevice } from "@/lib/useDevice";
import { screenFor } from "@/lib/device";
import { getInbox, getUnreadCount, markSeen, timeAgo, typeLabel, webHref, type NotificationItem } from "@/lib/notificationsApi";
import { dismissPrompt, enableWebPush, promptDismissed, syncWebPush, webPushState, type WebPushState } from "@/lib/webPush";

const POLL_MS = 90_000;

/** Navbar bell: unread count, and a panel with the latest notifications (+ turning on browser notifications). */
export default function NotificationBell({ align = "right" }: { align?: "left" | "right" }) {
  const { user, loaded } = useAuth();
  const { device } = useDevice();
  const screen = screenFor(device);
  const signedIn = !!user;
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [seenBefore, setSeenBefore] = useState<number>(0);
  const [error, setError] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const [push, setPush] = useState<WebPushState>("unsupported");
  const [pushBusy, setPushBusy] = useState(false);

  // Browser notifications: what this browser can do, and keep the subscription linked to the account.
  useEffect(() => {
    if (!loaded) return;
    void webPushState().then(setPush).catch(() => undefined);
    void syncWebPush();
  }, [loaded, signedIn]);

  const turnOnPush = async () => {
    setPushBusy(true);
    try {
      const ok = await enableWebPush();
      setPush(ok ? "on" : await webPushState());
    } finally {
      setPushBusy(false);
    }
  };

  const refreshCount = useCallback(() => {
    if (!loaded) return;
    void getUnreadCount(screen, signedIn).then(setUnread);
  }, [screen, signedIn, loaded]);

  useEffect(() => {
    refreshCount();
    const t = setInterval(refreshCount, POLL_MS);
    const onFocus = () => refreshCount();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshCount]);

  const openPanel = async () => {
    setOpen(true);
    setError(false);
    try {
      const page = await getInbox({ screen, signedIn, limit: 8 });
      setItems(page.data);
      setSeenBefore(new Date(page.seenAt).getTime());
      setUnread(0);
      await markSeen(signedIn);
    } catch {
      setError(true);
    }
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : void openPanel())}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/5"
        style={{ color: "var(--text-primary)" }}
      >
        <BellIcon size={19} strokeWidth={2} aria-hidden />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-extrabold" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className={`absolute ${align === "left" ? "left-0" : "right-0"} top-12 z-50 w-[min(400px,calc(100vw-24px))] overflow-hidden rounded-2xl`}
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-hover)", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
        >
          <div className="flex items-center px-4 pb-2 pt-4">
            <p className="flex-1 text-[26px] leading-none" style={{ fontFamily: "var(--font-serif)", color: "var(--text-primary)" }}>Notifications</p>
          </div>

          {push === "off" && !promptDismissed() && (
            <div className="mx-3 mb-2 flex flex-col gap-2.5 rounded-xl p-3" style={{ background: "var(--bg-secondary)" }}>
              <div className="flex items-start gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>
                  <BellIcon size={15} strokeWidth={2.4} aria-hidden />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Get notified in this browser</span>
                  <span className="text-[12.5px] leading-snug" style={{ color: "var(--text-secondary)" }}>New drops and your uploads, even when Aurora isn&apos;t open. Turn off any time.</span>
                </span>
              </div>
              <div className="flex gap-2">
                <button type="button" disabled={pushBusy} onClick={() => void turnOnPush()} className="h-9 flex-1 rounded-full text-[13px] font-extrabold disabled:opacity-50" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>
                  {pushBusy ? "Turning on…" : "Turn on"}
                </button>
                <button type="button" onClick={() => { dismissPrompt(); setPush("unavailable"); }} className="h-9 rounded-full px-4 text-[13px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Not now
                </button>
              </div>
            </div>
          )}
          {push === "denied" && (
            <p className="mx-4 mb-2 text-[12px]" style={{ color: "var(--text-muted)" }}>Browser notifications are blocked for this site. Allow them in the address bar&apos;s site settings to turn them on.</p>
          )}

          <div className="max-h-[60vh] overflow-y-auto">
            {error && <p className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>Couldn&apos;t load notifications.</p>}
            {!error && items === null && (
              <div className="flex flex-col gap-2 p-4">
                {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl" style={{ background: "var(--bg-secondary)" }} />)}
              </div>
            )}
            {items?.length === 0 && <p className="px-4 py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>Nothing yet. New drops and updates show up here.</p>}
            {items?.map((n) => (
              <NotificationRow key={n.id} n={n} unread={new Date(n.createdAt).getTime() > seenBefore} onNavigate={() => setOpen(false)} />
            ))}
          </div>

          <Link href="/notifications" onClick={() => setOpen(false)} className="block px-4 py-3 text-center text-[13px] font-bold" style={{ borderTop: "1px solid var(--border)", color: "var(--accent)" }}>
            See all notifications
          </Link>
        </div>
      )}
    </div>
  );
}

export function NotificationRow({ n, unread, onNavigate }: { n: NotificationItem; unread: boolean; onNavigate?: () => void }) {
  const { href, external } = webHref(n.url);
  const t = typeLabel(n.type);
  const content = (
    <>
      {n.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={n.imageUrl} alt="" loading="lazy" className="h-[60px] w-11 shrink-0 rounded-lg object-cover" style={{ background: "var(--bg-secondary)", opacity: unread ? 1 : 0.85 }} />
      ) : (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--bg-secondary)", color: "var(--text-muted)" }}>
          <BellIcon size={17} aria-hidden />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: t.color }}>{t.label} · {timeAgo(n.createdAt)}</span>
        <span className="text-sm" style={{ color: unread ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: unread ? 700 : 600 }}>{n.title}</span>
        {n.body && <span className="line-clamp-2 text-[12.5px]" style={{ color: "var(--text-muted)" }}>{n.body}</span>}
      </span>
      {unread && <span aria-label="Unread" className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: n.type === "drop" ? "#FF9A3C" : "var(--accent)" }} />}
    </>
  );
  const cls = "flex gap-3 px-4 py-3 transition-colors hover:bg-white/5";
  const style = unread ? { background: "rgba(129,238,78,0.04)" } : undefined;
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={onNavigate} className={cls} style={style}>{content}</a>
  ) : (
    <Link href={href} onClick={onNavigate} className={cls} style={style}>{content}</Link>
  );
}
