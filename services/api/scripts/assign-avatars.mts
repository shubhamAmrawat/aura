// One-time: give everyone without a profile picture a Night critter from Aurora's avatar pack.
// (New accounts get one at sign-up; this covers the accounts made before that.)
//   dev:        pnpm db:assign-avatars
//   production: pnpm db:assign-avatars:prod
import { describe } from "./lib/db-target.mts";
import type * as Db from "../src/config/db";
import type * as Models from "../src/models";
import type * as Pack from "../src/services/avatarPack.service";

// The API is CommonJS: load it through a dynamic import (as the other .mts scripts do).
const load = async <T,>(p: string): Promise<T> => { const m: any = await import(p); return (m.default ?? m) as T; };
const { db } = await load<typeof Db>("../src/config/db");
const { users } = await load<typeof Models>("../src/models");
const { assignDefaultAvatar } = await load<typeof Pack>("../src/services/avatarPack.service");
const { isNull } = await import("drizzle-orm");

console.log(`Target: ${describe(process.env.DATABASE_URL ?? "")}`);
const rows = await db.select({ id: users.id, username: users.username }).from(users).where(isNull(users.avatarUrl));
console.log(`${rows.length} account(s) without a profile picture.`);
let done = 0;
for (const u of rows) {
  try {
    if (await assignDefaultAvatar(u.id)) done++;
  } catch (e) {
    console.error(`  @${u.username}: failed —`, e instanceof Error ? e.message : e);
  }
}
console.log(`Done — ${done} avatar(s) assigned.`);
process.exit(0);
