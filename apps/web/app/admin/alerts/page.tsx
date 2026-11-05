"use client";

import { useEffect, useState } from "react";
import { getInbox, markSeen, type NotificationItem } from "@/lib/notificationsApi";
import { NotificationRow } from "@/app/components/NotificationBell";

/** Admin › Alerts: every admin alert sent to you (reports, creator applications, sign-ups, delivery problems). */
export default function AdminAlertsPage() {
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [seenBefore, setSeenBefore] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    getInbox({ signedIn: true, limit: 30, scope: "admin" })
      .then(async (page) => {
        if (!alive) return;
        setItems(page.data);
        setHasMore(page.hasMore);
        setSeenBefore(new Date(page.seenAt).getTime());
        await markSeen(true, "admin");
      })
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, []);

  const more = async () => {
    const last = items?.[items.length - 1];
    if (!last) return;
    setLoadingMore(true);
    try {
      const page = await getInbox({ signedIn: true, before: last.createdAt, limit: 30, scope: "admin" });
      setItems((prev) => [...(prev ?? []), ...page.data]);
      setHasMore(page.hasMore);
    } catch {
      setError(true);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="max-w-2xl pb-16">
      <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Alerts</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
        Reports, creator applications, new sign-ups and delivery problems. Choose which ones you get in Notifications › Rules.
      </p>
      <div className="mt-6 overflow-hidden rounded-2xl" style={{ border: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
        {error && <p className="px-4 py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>Couldn&apos;t load alerts. Try again in a moment.</p>}
        {!error && items === null && (
          <div className="flex flex-col gap-2 p-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl" style={{ background: "var(--bg-elevated)" }} />)}
          </div>
        )}
        {items?.length === 0 && <p className="px-4 py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>No alerts yet.</p>}
        {items?.map((n) => <NotificationRow key={n.id} n={n} unread={new Date(n.createdAt).getTime() > seenBefore} />)}
      </div>
      {hasMore && (
        <button onClick={more} disabled={loadingMore} className="mx-auto mt-4 block rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ border: "1px solid var(--border-hover)", color: "var(--text-primary)" }}>
          {loadingMore ? "Loading…" : "Show older"}
        </button>
      )}
    </div>
  );
}
