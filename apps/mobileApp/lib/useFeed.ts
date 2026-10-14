import { useCallback, useEffect, useRef, useState } from "react";

export type FeedPage<T> = { data: T[]; hasMore: boolean };
export type FeedStatus = "loading" | "ready" | "error";

/**
 * Paginated list state shared by every grid screen.
 * `key` resets the feed when it changes (e.g. a new query or category);
 * responses from an older key are dropped, and repeated ids are skipped.
 */
export function useFeed<T extends { id: string }>(
  fetchPage: (offset: number, limit: number) => Promise<FeedPage<T>>,
  key: string,
  pageSize = 24
) {
  const [items, setItems] = useState<T[]>([]);
  const [status, setStatus] = useState<FeedStatus>("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const offset = useRef(0);
  const hasMore = useRef(true);
  const busy = useRef(false);
  const generation = useRef(0);

  const load = useCallback(
    async (reset: boolean) => {
      if (!reset && (busy.current || !hasMore.current)) return;
      const gen = reset ? ++generation.current : generation.current;
      const from = reset ? 0 : offset.current;
      busy.current = true;
      if (!reset) setLoadingMore(true);
      try {
        const res = await fetchRef.current(from, pageSize);
        if (gen !== generation.current) return;
        setItems((prev) => {
          const base = reset ? [] : prev;
          const seen = new Set(base.map((i) => i.id));
          const fresh = res.data.filter((i) => !seen.has(i.id) && seen.add(i.id));
          return fresh.length === 0 && !reset ? prev : [...base, ...fresh];
        });
        offset.current = from + res.data.length;
        hasMore.current = res.hasMore && res.data.length > 0;
        setStatus("ready");
      } catch {
        // a failed next page is retried by scrolling again; a failed first page shows an error
        if (gen === generation.current && reset) setStatus("error");
      } finally {
        if (gen === generation.current) {
          busy.current = false;
          setLoadingMore(false);
        }
      }
    },
    [pageSize]
  );

  useEffect(() => {
    setItems([]);
    setStatus("loading");
    offset.current = 0;
    hasMore.current = true;
    void load(true);
  }, [key, load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    hasMore.current = true;
    await load(true);
    setRefreshing(false);
  }, [load]);

  const retry = useCallback(() => {
    setStatus("loading");
    hasMore.current = true;
    void load(true);
  }, [load]);

  const loadMore = useCallback(() => void load(false), [load]);

  return { items, status, loadingMore, refreshing, loadMore, refresh, retry };
}
