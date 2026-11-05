"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/authContext";
import { useDevice } from "@/lib/useDevice";
import { inboxScreen } from "@/lib/device";
import { getInbox, markSeen, type NotificationItem } from "@/lib/notificationsApi";
import { NotificationRow } from "@/app/components/NotificationBell";

/** All notifications: your own (signed in) and Aurora's broadcasts from the last 30 days. */
export default function NotificationsPage() {
  const { user, loaded } = useAuth();
  const { device } = useDevice();
  const screen = inboxScreen(device);
  const signedIn = !!user;
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [seenBefore, setSeenBefore] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!loaded) return;
    let alive = true;
    getInbox({ screen, signedIn, limit: 30 })
      .then(async (page) => {
        if (!alive) return;
        setItems(page.data);
        setHasMore(page.hasMore);
        setSeenBefore(new Date(page.seenAt).getTime());
        await markSeen(signedIn);
      })
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [loaded, screen, signedIn]);

  const more = async () => {
    const last = items?.[items.length - 1];
    if (!last) return;
    setLoadingMore(true);
    try {
      const page = await getInbox({ screen, signedIn, before: last.createdAt, limit: 30 });
      setItems((prev) => [...(prev ?? []), ...page.data]);
      setHasMore(page.hasMore);
    } catch {
      setError(true);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <main className="min-h-screen pt-24" style={{ background: "var(--bg-primary)" }}>
      <div className="mx-auto max-w-2xl px-4 pb-16">
        <h1 className="text-4xl md:text-5xl" style={{ fontFamily: "var(--font-serif)", color: "var(--text-primary)" }}>Notifications</h1>
        {!signedIn && loaded && (
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>Sign in to also see updates about your uploads and reports.</p>
        )}
        <div className="mt-6 overflow-hidden rounded-2xl" style={{ border: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
          {error && <p className="px-4 py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>Couldn&apos;t load notifications. Try again in a moment.</p>}
          {!error && items === null && (
            <div className="flex flex-col gap-2 p-4">
              {[0, 1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl" style={{ background: "var(--bg-elevated)" }} />)}
            </div>
          )}
          {items?.length === 0 && <p className="px-4 py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>Nothing yet. New drops and updates show up here.</p>}
          {items?.map((n) => <NotificationRow key={n.id} n={n} unread={new Date(n.createdAt).getTime() > seenBefore} />)}
        </div>
        {hasMore && (
          <button onClick={more} disabled={loadingMore} className="mx-auto mt-4 block rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ border: "1px solid var(--border-hover)", color: "var(--text-primary)" }}>
            {loadingMore ? "Loading…" : "Show older"}
          </button>
        )}
      </div>
    </main>
  );
}
