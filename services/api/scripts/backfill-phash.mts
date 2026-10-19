// One-time: add duplicate-detection fingerprints to every wallpaper that doesn't have one.
// (The hourly job also does this, 200 at a time — this just finishes it right away.)
//   dev:        pnpm db:backfill-phash
//   production: pnpm db:backfill-phash:prod
import { describe } from "./lib/db-target.mts";
import type * as Dup from "../src/services/duplicate.service";

// The API is CommonJS: load it through a dynamic import (as the other .mts scripts do).
const load = async <T,>(p: string): Promise<T> => { const m: any = await import(p); return (m.default ?? m) as T; };
const { fillMissingPhashes } = await load<typeof Dup>("../src/services/duplicate.service");

console.log(`Target: ${describe(process.env.DATABASE_URL ?? "")}`);
let total = 0;
for (;;) {
  const r = await fillMissingPhashes(200, 6);
  total += r.filled;
  console.log(`  +${r.filled} (failed ${r.failed}) · ${r.remaining} left`);
  if (r.remaining === 0 || r.filled === 0) break;
}
console.log(`Done — ${total} fingerprints added.`);
process.exit(0);
