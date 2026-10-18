import { AsyncLocalStorage } from "node:async_hooks";
import type { NextFunction, Request, Response } from "express";

/**
 * Per-request timing log. `timingLog` (middleware) prints one line when the response is sent:
 *   [timing] POST /api/auth/signup 200 640ms — db: checks 180ms · password hash 95ms · db: create user 150ms
 * Steps are recorded with `timed(label, fn)` anywhere inside the request; outside a timed request it
 * just runs `fn`. Steps that run at the same time (Promise.all) each show their own duration.
 */
type Store = { steps: [string, number][] };
const storage = new AsyncLocalStorage<Store>();

export async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const store = storage.getStore();
  if (!store) return fn();
  const start = performance.now();
  try {
    return await fn();
  } finally {
    store.steps.push([label, Math.round(performance.now() - start)]);
  }
}

export function timingLog(req: Request, res: Response, next: NextFunction) {
  const store: Store = { steps: [] };
  const start = performance.now();
  res.on("finish", () => {
    const total = Math.round(performance.now() - start);
    const steps = store.steps.map(([label, ms]) => `${label} ${ms}ms`).join(" · ");
    console.log(`[timing] ${req.method} ${req.originalUrl.split("?")[0]} ${res.statusCode} ${total}ms${steps ? ` — ${steps}` : ""}`);
  });
  storage.run(store, () => next());
}
