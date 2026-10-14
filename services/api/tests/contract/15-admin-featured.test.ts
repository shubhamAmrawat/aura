import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api } from "../setup/http";
import { sql } from "../setup/db";
import { createUser, makeAdmin, type TestUser } from "../setup/auth";
import { createTestWallpaper } from "../setup/fixtures";
import { expectError, expectKeys } from "../setup/assert";
import { useTestCleanup } from "../setup/lifecycle";

// These tests touch the LIVE featured lists (website + app) and their counts; they save and restore all of it.
useTestCleanup();

type List = "web" | "mobile";
const LISTS: List[] = ["web", "mobile"];
const LIMIT_KEYS: Record<List, string> = { web: "featured.limit", mobile: "featured.mobile.limit" };

let user: TestUser;
let admin: TestUser;
const original: Record<List, { limit: number; order: string[] }> = { web: { limit: 5, order: [] }, mobile: { limit: 5, order: [] } };
let savedLimitRows: { key: string; value: unknown }[] = [];

const getAdmin = (list: List = "web") => api("GET", `/api/admin/featured?list=${list}`, { token: admin.token });
const putOrder = (ids: string[], list: List = "web", token = admin.token) => api("PUT", "/api/admin/featured/order", { token, json: { ids, list } });
const putLimit = (limit: unknown, list: List = "web", token = admin.token) => api("PUT", "/api/admin/featured/limit", { token, json: { limit, list } });

/** Featured wallpapers in a hidden category (primary or extra) — the public lists leave these out. */
async function hiddenCategoryIds(): Promise<Set<string>> {
  const rows = await sql`
    SELECT w.id FROM wallpapers w
    WHERE w.category_id IN (SELECT id FROM categories WHERE is_hidden)
       OR EXISTS (SELECT 1 FROM wallpaper_categories wc JOIN categories c ON c.id = wc.category_id
                  WHERE wc.wallpaper_id = w.id AND c.is_hidden)`;
  return new Set(rows.map((r) => r.id as string));
}

beforeAll(async () => {
  [user, admin] = await Promise.all([createUser("ft-user"), createUser("ft-admin")]);
  await makeAdmin(admin);
  for (const list of LISTS) {
    const res = await getAdmin(list);
    original[list] = { limit: res.body.limit, order: res.body.items.map((w: { id: string }) => w.id) };
  }
  savedLimitRows = await sql`SELECT key, value FROM site_settings WHERE key IN ('featured.limit', 'featured.mobile.limit')`;
});

afterAll(async () => {
  // restore both lists (test wallpapers are removed by cleanup afterwards)
  const keep = [...original.web.order, ...original.mobile.order];
  await sql`UPDATE wallpapers SET is_featured = false, featured_order = NULL WHERE is_featured AND NOT (id = ANY(${keep}::uuid[]))`;
  for (const list of LISTS) {
    const ids = original[list].order;
    for (let i = 0; i < ids.length; i++) await sql`UPDATE wallpapers SET featured_order = ${i + 1} WHERE id = ${ids[i]!}`;
  }
  await sql`DELETE FROM site_settings WHERE key IN ('featured.limit', 'featured.mobile.limit')`;
  for (const row of savedLimitRows) await sql`INSERT INTO site_settings (key, value) VALUES (${row.key}, ${sql.json(row.value as number)})`;
});

describe("guard", () => {
  it("anonymous 401, users 403", async () => {
    expectError(await api("GET", "/api/admin/featured"), 401, "Unauthorized");
    expectError(await api("GET", "/api/admin/featured", { token: user.token }), 403, "Admin access required.");
    expectError(await putOrder([], "web", user.token), 403, "Admin access required.");
    expectError(await putLimit(5, "web", user.token), 403, "Admin access required.");
  });
});

describe("GET /api/admin/featured", () => {
  it.each(LISTS)("%s: list, limit, max and the items in order — one shape only", async (list) => {
    const res = await getAdmin(list);
    expect(res.status).toBe(200);
    expectKeys(res.body, ["list", "limit", "maxLimit", "items"]);
    expect(res.body.list).toBe(list);
    expect(res.body.maxLimit).toBe(10);
    const orders = res.body.items.map((w: { featuredOrder: number | null }) => w.featuredOrder ?? Infinity);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
    expect(res.body.items.every((w: { isMobile: boolean }) => w.isMobile === (list === "mobile"))).toBe(true);
    if (res.body.items[0]) {
      expectKeys(res.body.items[0], ["id", "title", "fileUrl", "thumbUrl", "dominantColor", "width", "height", "format", "tags", "status", "isMobile", "featuredOrder", "createdAt"]);
    }
  });

  it("defaults to the website list and rejects an unknown list", async () => {
    const res = await api("GET", "/api/admin/featured", { token: admin.token });
    expect(res.body.list).toBe("web");
    expectError(await api("GET", "/api/admin/featured?list=tv", { token: admin.token }), 400, "list must be web or mobile");
  });
});

describe("featuring goes to the list of the wallpaper's shape; unfeaturing removes the position", () => {
  it("phone → app list, desktop → website list, never both (PATCH and bulk)", async () => {
    const [phone, phone2, desktop] = await Promise.all([
      createTestWallpaper(admin, { status: "pending", isMobile: true }), // pending: never shown publicly
      createTestWallpaper(admin, { status: "pending", isMobile: true }),
      createTestWallpaper(admin, { status: "pending", isMobile: false }),
    ]);
    const before = { web: (await getAdmin("web")).body.items.length, mobile: (await getAdmin("mobile")).body.items.length };

    await api("PATCH", `/api/admin/wallpapers/${phone}`, { token: admin.token, json: { isFeatured: true } });
    await api("POST", "/api/admin/wallpapers/bulk", { token: admin.token, json: { ids: [phone2], action: "feature" } });
    await api("PATCH", `/api/admin/wallpapers/${desktop}`, { token: admin.token, json: { isFeatured: true } });

    const mobile = (await getAdmin("mobile")).body.items;
    const web = (await getAdmin("web")).body.items;
    expect(mobile).toHaveLength(before.mobile + 2);
    expect(web).toHaveLength(before.web + 1);
    expect(mobile.at(-2).id).toBe(phone);
    expect(mobile.at(-1).id).toBe(phone2);
    expect(mobile.at(-1).featuredOrder).toBe(mobile.at(-2).featuredOrder + 1);
    expect(web.at(-1).id).toBe(desktop);
    expect(web.some((w: { id: string }) => w.id === phone || w.id === phone2)).toBe(false);
    expect(mobile.some((w: { id: string }) => w.id === desktop)).toBe(false);

    // pending featured wallpapers never reach either public list
    for (const screen of ["mobile", "tablet"]) {
      const pub = await api("GET", `/api/featured?screen=${screen}`);
      expect(pub.body.data.some((w: { id: string }) => [phone, phone2, desktop].includes(w.id))).toBe(false);
    }

    for (const id of [phone, phone2, desktop]) {
      await api("PATCH", `/api/admin/wallpapers/${id}`, { token: admin.token, json: { isFeatured: false } });
      const [row] = await sql`SELECT is_featured, featured_order FROM wallpapers WHERE id = ${id}`;
      expect(row).toEqual({ is_featured: false, featured_order: null });
    }
  });

  it("changing a featured wallpaper's shape moves it to the end of the other list", async () => {
    const id = await createTestWallpaper(admin, { status: "pending", isMobile: true });
    await api("PATCH", `/api/admin/wallpapers/${id}`, { token: admin.token, json: { isFeatured: true } });
    expect((await getAdmin("mobile")).body.items.at(-1).id).toBe(id);
    await api("PATCH", `/api/admin/wallpapers/${id}`, { token: admin.token, json: { isMobile: false } });
    expect((await getAdmin("mobile")).body.items.some((w: { id: string }) => w.id === id)).toBe(false);
    expect((await getAdmin("web")).body.items.at(-1).id).toBe(id);
    await api("PATCH", `/api/admin/wallpapers/${id}`, { token: admin.token, json: { isFeatured: false } });
  });
});

describe("PUT /api/admin/featured/order", () => {
  it("refuses duplicates, stale lists and ids from the other list", async () => {
    const ids = (await getAdmin("web")).body.items.map((w: { id: string }) => w.id);
    if (ids.length >= 1) expectError(await putOrder([ids[0], ids[0], ...ids.slice(1)]), 400, "The list contains duplicates.");
    if (ids.length >= 1) expectError(await putOrder(ids.slice(1)), 409, "The featured list changed. Refresh and try again.");
    expectError(await putOrder([...ids, "00000000-0000-4000-8000-000000000000"]), 409, "The featured list changed. Refresh and try again.");
    expectError(await putOrder(["nope"]), 400, "Invalid wallpaper id");
    // the website's ids are not the app's list
    if (ids.length >= 1) expectError(await putOrder(ids, "mobile"), 409, "The featured list changed. Refresh and try again.");
  });

  it.each(LISTS)("%s: saves a new order (and logs which list)", async (list) => {
    const ids = (await getAdmin(list)).body.items.map((w: { id: string }) => w.id);
    if (ids.length < 2) return;
    const reversed = [...ids].reverse();
    const res = await putOrder(reversed, list);
    expect(res.status).toBe(200);
    expect(res.body.items.map((w: { id: string }) => w.id)).toEqual(reversed);
    expect(res.body.items.map((w: { featuredOrder: number }) => w.featuredOrder)).toEqual(reversed.map((_, i) => i + 1));
    const [log] = await sql`SELECT details FROM admin_actions WHERE admin_id = ${admin.id} AND action = 'featured.reorder' ORDER BY created_at DESC LIMIT 1`;
    expect(log!.details).toEqual({ list, order: reversed });
    await putOrder(ids, list); // put it back
  });
});

describe("limits + public endpoint", () => {
  it("validates the limit", async () => {
    for (const bad of [0, 11, 2.5, "5", null]) {
      expectError(await putLimit(bad), 400, "limit must be a number from 1 to 10");
    }
    expectError(await putLimit(5, "tv" as List), 400, "list must be web or mobile");
  });

  it.each([["web", "tablet"], ["web", null], ["mobile", "mobile"]] as const)(
    "%s list is what /api/featured?screen=%s returns: admin order, approved, visible, cut to its limit",
    async (list, screen) => {
      const hidden = await hiddenCategoryIds();
      const adminState = (await getAdmin(list)).body;
      const pub = await api("GET", screen ? `/api/featured?screen=${screen}` : "/api/featured");
      expect(pub.status).toBe(200);
      expectKeys(pub.body, ["data", "limit"]);
      expect(pub.body.limit).toBe(adminState.limit);
      const expected = adminState.items
        .filter((w: { id: string; status: string }) => w.status === "approved" && !hidden.has(w.id))
        .slice(0, adminState.limit)
        .map((w: { id: string }) => w.id);
      expect(pub.body.data.map((w: { id: string }) => w.id)).toEqual(expected);
      expect(pub.body.data.every((w: { isMobile: boolean }) => w.isMobile === (list === "mobile"))).toBe(true);
      expect(pub.headers.get("cache-control")).toBe("no-store");
    }
  );

  it("the two counts are independent (restored after)", async () => {
    const web = original.web.limit;
    const mobileTarget = original.mobile.limit === 3 ? 4 : 3;
    const res = await putLimit(mobileTarget, "mobile");
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(mobileTarget);
    expect((await getAdmin("web")).body.limit).toBe(web);
    expect((await api("GET", "/api/featured?screen=mobile")).body.limit).toBe(mobileTarget);
    expect((await api("GET", "/api/featured?screen=tablet")).body.limit).toBe(web);
    const [log] = await sql`SELECT target_id, details FROM admin_actions WHERE admin_id = ${admin.id} AND action = 'featured.limit' ORDER BY created_at DESC LIMIT 1`;
    expect(log!.target_id).toBe(LIMIT_KEYS.mobile);
    expect(log!.details).toEqual({ list: "mobile", from: original.mobile.limit, to: mobileTarget });
  });

  it("rejects an unknown screen value", async () => {
    expect((await api("GET", "/api/featured?screen=watch")).status).toBe(400);
  });
});
