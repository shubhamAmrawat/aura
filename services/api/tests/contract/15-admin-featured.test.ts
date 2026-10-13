import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api } from "../setup/http";
import { sql } from "../setup/db";
import { createUser, makeAdmin, type TestUser } from "../setup/auth";
import { createTestWallpaper } from "../setup/fixtures";
import { expectError, expectKeys } from "../setup/assert";
import { useTestCleanup } from "../setup/lifecycle";

// These tests touch the LIVE featured order + limit; they save and restore both.
useTestCleanup();

let user: TestUser;
let admin: TestUser;
let originalLimit: number;
let originalOrder: string[];

const getAdmin = () => api("GET", "/api/admin/featured", { token: admin.token });
const putOrder = (ids: string[], token = admin.token) => api("PUT", "/api/admin/featured/order", { token, json: { ids } });
const putLimit = (limit: unknown, token = admin.token) => api("PUT", "/api/admin/featured/limit", { token, json: { limit } });

beforeAll(async () => {
  [user, admin] = await Promise.all([createUser("ft-user"), createUser("ft-admin")]);
  await makeAdmin(admin);
  const res = await getAdmin();
  originalLimit = res.body.limit;
  originalOrder = res.body.items.map((w: { id: string }) => w.id);
});

afterAll(async () => {
  // restore the live state (test wallpapers are removed by cleanup afterwards)
  await sql`UPDATE wallpapers SET is_featured = false, featured_order = NULL WHERE is_featured AND NOT (id = ANY(${originalOrder}::uuid[]))`;
  for (let i = 0; i < originalOrder.length; i++) {
    await sql`UPDATE wallpapers SET featured_order = ${i + 1} WHERE id = ${originalOrder[i]!}`;
  }
  await sql`UPDATE site_settings SET value = ${sql.json(originalLimit)} WHERE key = 'featured.limit'`;
});

describe("guard", () => {
  it("anonymous 401, users 403", async () => {
    expectError(await api("GET", "/api/admin/featured"), 401, "Unauthorized");
    expectError(await api("GET", "/api/admin/featured", { token: user.token }), 403, "Admin access required.");
    expectError(await putOrder([], user.token), 403, "Admin access required.");
    expectError(await putLimit(5, user.token), 403, "Admin access required.");
  });
});

describe("GET /api/admin/featured", () => {
  it("returns limit, max and the featured list in order", async () => {
    const res = await getAdmin();
    expect(res.status).toBe(200);
    expectKeys(res.body, ["limit", "maxLimit", "items"]);
    expect(res.body.maxLimit).toBe(10);
    const orders = res.body.items.map((w: { featuredOrder: number | null }) => w.featuredOrder ?? Infinity);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
    if (res.body.items[0]) {
      expectKeys(res.body.items[0], ["id", "title", "fileUrl", "thumbUrl", "dominantColor", "width", "height", "format", "tags", "status", "isMobile", "featuredOrder", "createdAt"]);
    }
  });
});

describe("featuring adds to the end, unfeaturing removes the position", () => {
  it("via PATCH and bulk", async () => {
    const [a, b] = await Promise.all([
      createTestWallpaper(admin, { status: "pending" }), // pending: never on the live site
      createTestWallpaper(admin, { status: "pending" }),
    ]);
    const before = (await getAdmin()).body.items.length;

    await api("PATCH", `/api/admin/wallpapers/${a}`, { token: admin.token, json: { isFeatured: true } });
    await api("POST", "/api/admin/wallpapers/bulk", { token: admin.token, json: { ids: [b], action: "feature" } });
    const items = (await getAdmin()).body.items;
    expect(items).toHaveLength(before + 2);
    expect(items.at(-2).id).toBe(a);
    expect(items.at(-1).id).toBe(b);
    expect(items.at(-1).featuredOrder).toBe(items.at(-2).featuredOrder + 1);

    // pending featured wallpapers never reach the public hero
    const pub = await api("GET", "/api/featured");
    expect(pub.body.data.some((w: { id: string }) => w.id === a || w.id === b)).toBe(false);

    await api("PATCH", `/api/admin/wallpapers/${a}`, { token: admin.token, json: { isFeatured: false } });
    const [row] = await sql`SELECT is_featured, featured_order FROM wallpapers WHERE id = ${a}`;
    expect(row).toEqual({ is_featured: false, featured_order: null });
    await api("PATCH", `/api/admin/wallpapers/${b}`, { token: admin.token, json: { isFeatured: false } });
  });
});

describe("PUT /api/admin/featured/order", () => {
  it("refuses duplicates and stale lists", async () => {
    const ids = (await getAdmin()).body.items.map((w: { id: string }) => w.id);
    if (ids.length >= 1) expectError(await putOrder([ids[0], ids[0], ...ids.slice(1)]), 400, "The list contains duplicates.");
    if (ids.length >= 1) expectError(await putOrder(ids.slice(1)), 409, "The featured list changed. Refresh and try again.");
    expectError(await putOrder([...ids, "00000000-0000-4000-8000-000000000000"]), 409, "The featured list changed. Refresh and try again.");
    expectError(await putOrder(["nope"]), 400, "Invalid wallpaper id");
  });

  it("saves a new order (and logs it)", async () => {
    const ids = (await getAdmin()).body.items.map((w: { id: string }) => w.id);
    if (ids.length < 2) return;
    const reversed = [...ids].reverse();
    const res = await putOrder(reversed);
    expect(res.status).toBe(200);
    expect(res.body.items.map((w: { id: string }) => w.id)).toEqual(reversed);
    expect(res.body.items.map((w: { featuredOrder: number }) => w.featuredOrder)).toEqual(reversed.map((_, i) => i + 1));
    const [log] = await sql`SELECT details FROM admin_actions WHERE admin_id = ${admin.id} AND action = 'featured.reorder' ORDER BY created_at DESC LIMIT 1`;
    expect(log!.details.order).toEqual(reversed);
    await putOrder(ids); // put it back
  });
});

describe("limit + public endpoint", () => {
  it("validates the limit", async () => {
    for (const bad of [0, 11, 2.5, "5", null]) {
      expectError(await putLimit(bad), 400, "limit must be a number from 1 to 10");
    }
  });

  it("public /api/featured follows the admin order, approved only, cut to the limit", async () => {
    const admin1 = (await getAdmin()).body;
    const pub = await api("GET", "/api/featured");
    expect(pub.status).toBe(200);
    expectKeys(pub.body, ["data", "limit"]);
    expect(pub.body.limit).toBe(admin1.limit);
    const expected = admin1.items.filter((w: { status: string }) => w.status === "approved").slice(0, admin1.limit).map((w: { id: string }) => w.id);
    expect(pub.body.data.map((w: { id: string }) => w.id)).toEqual(expected);
    expect(pub.headers.get("cache-control")).toBe("no-store");
  });

  it("changing the limit changes the public count (restored after)", async () => {
    const approvedCount = (await getAdmin()).body.items.filter((w: { status: string }) => w.status === "approved").length;
    const target = originalLimit === 1 ? 2 : originalLimit - 1;
    const res = await putLimit(target);
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(target);
    expect((await api("GET", "/api/featured")).body.data).toHaveLength(Math.min(target, approvedCount));
    const [log] = await sql`SELECT details FROM admin_actions WHERE admin_id = ${admin.id} AND action = 'featured.limit' ORDER BY created_at DESC LIMIT 1`;
    expect(log!.details).toEqual({ from: originalLimit, to: target });
    await putLimit(originalLimit);
  });
});
