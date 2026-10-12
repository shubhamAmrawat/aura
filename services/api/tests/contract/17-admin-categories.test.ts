import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api } from "../setup/http";
import { sql } from "../setup/db";
import { createUser, makeAdmin, type TestUser } from "../setup/auth";
import { createTestWallpaper } from "../setup/fixtures";
import { expectError, NONEXISTENT_UUID } from "../setup/assert";
import { useTestCleanup } from "../setup/lifecycle";
import { RUN_ID } from "../setup/run";

let viewer: TestUser;
let admin: TestUser;
let liveOrder: { id: string; sort_order: number }[] = [];
const SLUG = `aura-test-${RUN_ID.toLowerCase()}`;
const NAME = `Aura Test ${RUN_ID}`;

beforeAll(async () => {
  viewer = await createUser("cat-viewer");
  admin = await createUser("cat-admin");
  await makeAdmin(admin);
  liveOrder = await sql`SELECT id, sort_order FROM categories WHERE slug NOT LIKE 'aura-test-%'`;
});

// Registered AFTER useTestCleanup so it runs first (after-hooks run in reverse): hand test
// wallpapers back to a real category, drop this run's categories, restore the live order.
useTestCleanup();
afterAll(async () => {
  const [real] = await sql<{ id: string }[]>`SELECT id FROM categories WHERE slug NOT LIKE 'aura-test-%' ORDER BY sort_order LIMIT 1`;
  await sql`UPDATE wallpapers SET category_id = ${real!.id} WHERE category_id IN (SELECT id FROM categories WHERE slug LIKE ${SLUG + "%"})`;
  await sql`DELETE FROM categories WHERE slug LIKE ${SLUG + "%"}`;
  for (const c of liveOrder) await sql`UPDATE categories SET sort_order = ${c.sort_order} WHERE id = ${c.id}`;
});

const call = (method: string, path: string, json?: unknown, token = admin.token) => api(method, `/api/admin/categories${path}`, { token, json });

describe("admin categories — access", () => {
  it("needs an admin", async () => {
    expectError(await api("GET", "/api/admin/categories"), 401, "Unauthorized");
    expectError(await call("GET", "", undefined, viewer.token), 403, "Admin access required.");
    expectError(await call("POST", "", { name: "x" }, viewer.token), 403, "Admin access required.");
  });
});

describe("GET /api/admin/categories", () => {
  it("lists every category in order with counts and a preview", async () => {
    const res = await call("GET", "");
    expect(res.status).toBe(200);
    const data = res.body.data as any[];
    const [{ n }] = await sql`SELECT count(*)::int n FROM categories`;
    expect(data).toHaveLength(n);
    for (const c of data) {
      expect(Object.keys(c).sort()).toEqual(["coverImageUrl", "description", "id", "live", "name", "previewUrl", "slug", "sortOrder", "total"]);
      expect(c.live).toBeLessThanOrEqual(c.total);
    }
    for (let i = 1; i < data.length; i++) expect(data[i - 1].sortOrder).toBeLessThanOrEqual(data[i].sortOrder);
    const sample = data.find((c) => c.live > 0);
    const [{ live }] = await sql`SELECT count(*)::int live FROM wallpapers WHERE category_id = ${sample.id} AND status = 'approved'`;
    expect(sample.live).toBe(live);
    expect(sample.previewUrl).toMatch(/^https:\/\//);
  });
});

describe("POST /api/admin/categories", () => {
  it("validates", async () => {
    expectError(await call("POST", "", { name: " " }), 400, "Name is required");
    expectError(await call("POST", "", { name: "x".repeat(41) }), 400, "Name can be at most 40 characters");
    expectError(await call("POST", "", { name: "Ok", slug: "Bad Slug" }), 400, "Slug can only use lowercase letters, numbers and single hyphens");
    expectError(await call("POST", "", { name: "Ok", slug: "a" }), 400, "Slug must be 2–40 characters");
    expectError(await call("POST", "", { name: "!!!" }), 400, "Add a slug — the name has too few letters or numbers to make one.");
    expectError(await call("POST", "", { name: "Ok", extra: 1 }), 400, 'Unrecognized key: "extra"');
  });

  it("creates at the end with an auto slug; duplicates are refused", async () => {
    const res = await call("POST", "", { name: `${NAME} Café`, description: "  test  " });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: `${NAME} Café`, slug: `${SLUG}-cafe`, description: "test", coverImageUrl: null });
    const [{ m }] = await sql`SELECT max(sort_order)::int m FROM categories`;
    expect(res.body.sortOrder).toBe(m);
    expectError(await call("POST", "", { name: `${NAME} CAFÉ`, slug: `${SLUG}-other` }), 409, "A category with this name already exists.");
    expectError(await call("POST", "", { name: `${NAME} Other`, slug: `${SLUG}-cafe` }), 409, "A category with this slug already exists.");
    const [audit] = await sql`SELECT action FROM admin_actions WHERE target_id = ${res.body.id}`;
    expect(audit!.action).toBe("category.create");
    // shows up publicly
    const pub = await api("GET", "/api/categories");
    expect(pub.body.data.some((c: any) => c.id === res.body.id)).toBe(true);
  });
});

describe("PATCH /api/admin/categories/:id", () => {
  it("edits fields, checks uniqueness and the cover URL, audits changes", async () => {
    const { body: a } = await call("POST", "", { name: `${NAME} A`, slug: `${SLUG}-a` });
    const { body: b } = await call("POST", "", { name: `${NAME} B`, slug: `${SLUG}-b` });
    expectError(await call("PATCH", `/${NONEXISTENT_UUID}`, { name: "x" }), 404, "Category not found");
    expectError(await call("PATCH", "/not-a-uuid", { name: "x" }), 404, "Category not found");
    expectError(await call("PATCH", `/${a.id}`, {}), 400, "Nothing to update");
    expectError(await call("PATCH", `/${a.id}`, { slug: `${SLUG}-b` }), 409, "A category with this slug already exists.");
    expectError(await call("PATCH", `/${a.id}`, { name: b.name.toLowerCase() }), 409, "A category with this name already exists.");
    expectError(await call("PATCH", `/${a.id}`, { coverImageUrl: "https://evil.example.com/x.jpg" }), 400, "The cover must be an image hosted on Aurora.");

    const cover = `${process.env.R2_PUBLIC_URL}/wallpapers/example.jpg`;
    const res = await call("PATCH", `/${a.id}`, { name: `${NAME} A2`, slug: `${SLUG}-a2`, description: "d", coverImageUrl: cover });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: `${NAME} A2`, slug: `${SLUG}-a2`, description: "d", coverImageUrl: cover });
    const list = await call("GET", "");
    expect(list.body.data.find((c: any) => c.id === a.id).previewUrl).toBe(cover);

    const cleared = await call("PATCH", `/${a.id}`, { coverImageUrl: null, description: "" });
    expect(cleared.body).toMatchObject({ coverImageUrl: null, description: null });
    const [audit] = await sql`SELECT details FROM admin_actions WHERE target_id = ${a.id} AND action = 'category.update' ORDER BY created_at LIMIT 1`;
    expect(audit!.details.changes.slug).toEqual({ from: `${SLUG}-a`, to: `${SLUG}-a2` });
  });
});

describe("PUT /api/admin/categories/order", () => {
  it("requires the full list and saves it", async () => {
    const { body } = await call("GET", "");
    const ids = (body.data as any[]).map((c) => c.id);
    expectError(await call("PUT", "/order", { ids: ids.slice(1) }), 409, "The category list changed. Refresh and try again.");
    expectError(await call("PUT", "/order", { ids: [...ids.slice(1), ids[1]] }), 400, "The list contains duplicates.");
    expectError(await call("PUT", "/order", { ids: ["x"] }), 400, "Invalid category id");
    const reversed = [...ids].reverse();
    const res = await call("PUT", "/order", { ids: reversed });
    expect(res.status).toBe(200);
    expect((res.body.data as any[]).map((c) => c.id)).toEqual(reversed);
    expect((res.body.data as any[]).map((c) => c.sortOrder)).toEqual(reversed.map((_, i) => i));
    const pub = await api("GET", "/api/categories");
    expect((pub.body.data as any[]).map((c) => c.id)).toEqual(reversed);
    // restore right away (afterAll restores again)
    for (const c of liveOrder) await sql`UPDATE categories SET sort_order = ${c.sort_order} WHERE id = ${c.id}`;
  });
});

describe("DELETE /api/admin/categories/:id", () => {
  it("empty category deletes; one with wallpapers needs moveTo, which moves them in one go", async () => {
    const { body: empty } = await call("POST", "", { name: `${NAME} Empty`, slug: `${SLUG}-empty` });
    const del = await call("DELETE", `/${empty.id}`);
    expect(del.status).toBe(200);
    expect(del.body).toEqual({ id: empty.id, deleted: true, moved: 0, moveTo: null });

    const { body: from } = await call("POST", "", { name: `${NAME} From`, slug: `${SLUG}-from` });
    const { body: to } = await call("POST", "", { name: `${NAME} To`, slug: `${SLUG}-to` });
    const w1 = await createTestWallpaper(admin);
    const w2 = await createTestWallpaper(admin);
    await sql`UPDATE wallpapers SET category_id = ${from.id} WHERE id IN (${w1}, ${w2})`;

    expectError(await call("DELETE", `/${from.id}`), 409, "This category has 2 wallpapers. Choose a category to move them to.");
    expectError(await call("DELETE", `/${from.id}?moveTo=${from.id}`), 400, "Pick a different category to move the wallpapers to.");
    expectError(await call("DELETE", `/${from.id}?moveTo=${NONEXISTENT_UUID}`), 400, "The category to move wallpapers to was not found.");
    expectError(await call("DELETE", `/${from.id}?moveTo=nope`), 400, "Invalid category to move to");
    expectError(await call("DELETE", `/${NONEXISTENT_UUID}`), 404, "Category not found");

    const ok = await call("DELETE", `/${from.id}?moveTo=${to.id}`);
    expect(ok.body).toEqual({ id: from.id, deleted: true, moved: 2, moveTo: to.id });
    const rows = await sql`SELECT category_id FROM wallpapers WHERE id IN (${w1}, ${w2})`;
    expect(rows.every((r: any) => r.category_id === to.id)).toBe(true);
    expect((await sql`SELECT 1 FROM categories WHERE id = ${from.id}`).length).toBe(0);
    const [audit] = await sql`SELECT details FROM admin_actions WHERE target_id = ${from.id} AND action = 'category.delete'`;
    expect(audit!.details).toMatchObject({ moved: 2, moveTo: to.id, slug: `${SLUG}-from` });
  });
});

describe("old slugs keep working (renames + merges)", () => {
  it("rename and merge record redirects; public resolve + wallpaper list follow them", async () => {
    const { body: a } = await call("POST", "", { name: `${NAME} R1`, slug: `${SLUG}-r1` });
    const { body: b } = await call("POST", "", { name: `${NAME} R2`, slug: `${SLUG}-r2` });
    const w = await createTestWallpaper(admin);
    await sql`UPDATE wallpapers SET category_id = ${a.id}, status = 'rejected' WHERE id = ${w}`; // never public

    // rename r1 → r1b: old slug resolves to the new one
    expect((await call("PATCH", `/${a.id}`, { slug: `${SLUG}-r1b` })).status).toBe(200);
    let r = await api("GET", `/api/categories/resolve/${SLUG}-r1`);
    expect(r.body).toEqual({ slug: `${SLUG}-r1b`, redirected: true });
    expect((await api("GET", `/api/categories/resolve/${SLUG}-r1b`)).body).toEqual({ slug: `${SLUG}-r1b`, redirected: false });
    expectError(await api("GET", `/api/categories/resolve/${SLUG}-nope`), 404, "Category not found");
    const map = await api("GET", "/api/categories/redirects");
    expect(map.headers.get("cache-control")).toBe("public, s-maxage=300");
    expect(map.body.data[`${SLUG}-r1`]).toBe(`${SLUG}-r1b`);

    // the public list filter follows the old slug (same result as the new one)
    await sql`UPDATE wallpapers SET status = 'approved' WHERE id = ${w}`;
    try {
      const viaOld = await api("GET", `/api/wallpapers?category=${SLUG}-r1&limit=5`);
      expect(viaOld.body.data.map((x: any) => x.id)).toEqual([w]);
    } finally {
      await sql`UPDATE wallpapers SET status = 'rejected' WHERE id = ${w}`;
    }

    // merge r1b into r2: both old slugs now lead to r2
    expect((await call("DELETE", `/${a.id}?moveTo=${b.id}`)).body.moved).toBe(1);
    expect((await api("GET", `/api/categories/resolve/${SLUG}-r1`)).body.slug).toBe(`${SLUG}-r2`);
    expect((await api("GET", `/api/categories/resolve/${SLUG}-r1b`)).body.slug).toBe(`${SLUG}-r2`);

    // a new category can take an old slug back; the redirect is dropped
    const { body: c } = await call("POST", "", { name: `${NAME} R1 again`, slug: `${SLUG}-r1` });
    expect((await api("GET", `/api/categories/resolve/${SLUG}-r1`)).body).toEqual({ slug: `${SLUG}-r1`, redirected: false });
    expect((await sql`SELECT 1 FROM category_redirects WHERE old_slug = ${SLUG + "-r1"}`).length).toBe(0);
    expect(c.slug).toBe(`${SLUG}-r1`);
  });
});
