import { beforeAll, describe, expect, it } from "vitest";
import { api } from "../setup/http";
import { sql } from "../setup/db";
import { createUser, makeAdmin, type TestUser } from "../setup/auth";
import { createTestWallpaper } from "../setup/fixtures";
import { expectError, expectKeys } from "../setup/assert";
import { useTestCleanup } from "../setup/lifecycle";

useTestCleanup();

let creator: TestUser;
let user: TestUser;
let admin: TestUser;
const dash = (q = "", token = admin.token) => api("GET", `/api/admin/stats/dashboard${q}`, { token });

beforeAll(async () => {
  [creator, user, admin] = await Promise.all([createUser("db-creator"), createUser("db-user"), createUser("db-admin")]);
  await makeAdmin(admin);
});

describe("view / download tracking with client source", () => {
  it("views go into the daily log per source; unknown sources are 'unknown'", async () => {
    const id = await createTestWallpaper(creator, { status: "approved" });
    await api("POST", `/api/wallpapers/${id}/view`, { json: { source: "web" } });
    await api("POST", `/api/wallpapers/${id}/view`, { json: { source: "web" } });
    await api("POST", `/api/wallpapers/${id}/view`, { json: { source: "mobile" } });
    await api("POST", `/api/wallpapers/${id}/view`, { json: { source: "smart-fridge" } });
    await api("POST", `/api/wallpapers/${id}/view`); // no body (older clients)
    const rows = await sql<{ source: string; views: number }[]>`
      SELECT source, views FROM wallpaper_views_daily WHERE wallpaper_id = ${id} ORDER BY source`;
    expect(rows).toEqual([
      { source: "mobile", views: 1 },
      { source: "unknown", views: 2 },
      { source: "web", views: 2 },
    ]);
    expect((await sql`SELECT view_count FROM wallpapers WHERE id = ${id}`)[0]!.view_count).toBe(5);
  });

  it("views of non-approved wallpapers are not logged", async () => {
    const id = await createTestWallpaper(creator, { status: "pending" });
    await api("POST", `/api/wallpapers/${id}/view`, { json: { source: "web" } });
    expect((await sql`SELECT 1 FROM wallpaper_views_daily WHERE wallpaper_id = ${id}`).length).toBe(0);
  });

  it("downloads record their source", async () => {
    const id = await createTestWallpaper(creator, { status: "approved" });
    await api("POST", `/api/wallpapers/${id}/download`, { json: { source: "mobile" } });
    await api("POST", `/api/wallpapers/${id}/download`);
    const rows = await sql<{ source: string }[]>`SELECT source FROM downloads WHERE wallpaper_id = ${id} ORDER BY source`;
    expect(rows.map((r) => r.source)).toEqual(["mobile", "unknown"]);
  });
});

describe("GET /api/admin/stats/dashboard", () => {
  it("guarded + validated", async () => {
    expectError(await api("GET", "/api/admin/stats/dashboard"), 401, "Unauthorized");
    expectError(await dash("", user.token), 403, "Admin access required.");
    expectError(await dash("?days=14"), 400, "days must be 7, 30 or 90");
  });

  it("returns the full shape; series length = days", async () => {
    for (const days of [7, 30, 90] as const) {
      const res = await dash(`?days=${days}`);
      expect(res.status).toBe(200);
      expect(res.body.days).toBe(days);
      expect(res.body.series).toHaveLength(days);
    }
    const res = await dash();
    expect(res.body.days).toBe(30);
    expectKeys(res.body, ["days", "timezone", "totals", "kpis", "series", "attention", "categories", "top", "platform", "recent", "generatedAt"]);
    expectKeys(res.body.totals, ["liveWallpapers", "users", "creators", "pending", "downloads", "views", "likes"]);
    expectKeys(res.body.kpis, ["downloads", "views", "likes", "signups", "uploads"]);
    expectKeys(res.body.kpis.downloads, ["last7d", "prev7d", "spark"]);
    expect(res.body.kpis.downloads.spark).toHaveLength(14);
    expectKeys(res.body.series[0], ["day", "downloads", "views", "likes", "signups", "uploads"]);
    expectKeys(res.body.attention, ["pending", "oldestPendingAt", "rejected", "rejectedExpiringSoon", "storageBytes"]);
    expectKeys(res.body.top, ["downloads", "likes", "views"]);
    expectKeys(res.body.platform, ["downloads", "views"]);
    expectKeys(res.body.platform.views, ["web", "mobile", "unknown"]);
    expect(res.body.timezone).toBe("Asia/Kolkata");
    // last series day = today in India
    const todayIst = new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
    expect(res.body.series.at(-1).day).toBe(todayIst);
  });

  it("counts today's activity for a fresh wallpaper", async () => {
    const before = (await dash("?days=7")).body;
    const id = await createTestWallpaper(creator, { status: "approved" });
    await api("POST", `/api/wallpapers/${id}/view`, { json: { source: "web" } });
    await api("POST", `/api/wallpapers/${id}/download`, { json: { source: "web" } });
    await sql`INSERT INTO likes (user_id, wallpaper_id) VALUES (${user.id}, ${id})`;
    const after = (await dash("?days=7")).body;

    const t0 = before.series.at(-1);
    const t1 = after.series.at(-1);
    expect(t1.views).toBe(t0.views + 1);
    expect(t1.downloads).toBe(t0.downloads + 1);
    expect(t1.likes).toBe(t0.likes + 1);
    expect(t1.uploads).toBe(t0.uploads + 1);
    expect(after.platform.views.web).toBe(before.platform.views.web + 1);
    expect(after.kpis.downloads.last7d).toBe(before.kpis.downloads.last7d + 1);
    expect(after.top.views.some((w: { id: string }) => w.id === id)).toBe(true);
    expect(after.recent.some((e: { kind: string; who: string }) => e.kind === "upload" && e.who === creator.username)).toBe(true);
  });
});
