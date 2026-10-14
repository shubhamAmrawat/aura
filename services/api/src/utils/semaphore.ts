/**
 * At most `limit` callers run at once; the rest wait their turn (FIFO).
 * Used to keep heavy image work from exhausting memory when many uploads arrive together.
 */
export function createSemaphore(limit: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  const acquire = () =>
    new Promise<void>((resolve) => {
      if (active < limit) {
        active++;
        resolve();
      } else {
        waiting.push(() => {
          active++;
          resolve();
        });
      }
    });
  const release = () => {
    active--;
    waiting.shift()?.();
  };
  return async function run<T>(task: () => Promise<T>): Promise<T> {
    await acquire();
    try {
      return await task();
    } finally {
      release();
    }
  };
}
