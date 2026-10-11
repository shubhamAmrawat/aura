import { afterAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { sql } from "../setup/db";
import { cleanupTestData } from "../setup/cleanup";
import { RUN_EMAIL_PATTERN, RUN_ID, testEmail } from "../setup/run";
import { createTestWallpaper } from "../setup/fixtures";
import type { TestUser } from "../setup/auth";

const { purgeExpiredRejected, REJECTED_RETENTION_DAYS } = await import("../../src/services/admin/review.service");

afterAll(async () => {
  await cleanupTestData(RUN_EMAIL_PATTERN);
  await sql.end();
});

describe("purgeExpiredRejected (job)", () => {
  it(`deletes wallpapers rejected more than ${REJECTED_RETENTION_DAYS} days ago, keeps newer ones`, async () => {
    const [u] = await sql<{ id: string }[]>`
      INSERT INTO users (email, username, display_name, password_hash, total_uploads)
      VALUES (${testEmail("purge")}, ${`t_${RUN_ID}_purge`}, ${"Purge test"}, ${await bcrypt.hash("x", 4)}, 2)
      RETURNING id`;
    const owner = { id: u!.id, username: `t_${RUN_ID}_purge` } as TestUser;
    const [old, recent] = await Promise.all([createTestWallpaper(owner), createTestWallpaper(owner)]);
    await sql`UPDATE wallpapers SET status = 'rejected', rejected_at = now() - interval '31 days' WHERE id = ${old}`;
    await sql`UPDATE wallpapers SET status = 'rejected', rejected_at = now() - interval '5 days' WHERE id = ${recent}`;

    const { purged } = await purgeExpiredRejected();
    expect(purged).toBeGreaterThanOrEqual(1);

    expect((await sql`SELECT 1 FROM wallpapers WHERE id = ${old}`).length).toBe(0);
    expect((await sql`SELECT 1 FROM wallpapers WHERE id = ${recent}`).length).toBe(1);
    expect((await sql`SELECT total_uploads FROM users WHERE id = ${u!.id}`)[0]!.total_uploads).toBe(1);
    const log = await sql`SELECT action, admin_id FROM admin_actions WHERE target_id = ${old}`;
    expect(log).toEqual([{ action: "wallpaper.purge", admin_id: null }]);
    await sql`DELETE FROM admin_actions WHERE target_id = ${old}`; // the purged row is gone, so cleanup can't find this one
  });
});
