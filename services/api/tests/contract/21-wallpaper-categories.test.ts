import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api } from "../setup/http";
import { sql } from "../setup/db";
import { createUser, makeAdmin, type TestUser } from "../setup/auth";
import { createTestWallpaper } from "../setup/fixtures";
import { expectError } from "../setup/assert";
import { useTestCleanup } from "../setup/lifecycle";
import { RUN_ID } from "../setup/run";

let creator: TestUser;
let admin: TestUser;
const SLUG = `aura-test-mc-${RUN_ID.toLowerCase()}`;
let primary: { id: string; slug: string };
let extraA: { id: string; slug: string };
let extraB: { id: string; slug: string };
let extraC: { id: string; slug: string };

const cats = (path: string, json?: unknown, method = "POST") => api(method, `/api/admin/categories${path}`, { token: admin.token, json });
const patch = (id: string, json: unknown) => api("PATCH", `/api/admin/wallpapers/${id}`, { token: admin.token, json });
const detail = async (id: string) => (await api("GET", `/api/admin/wallpapers/${id}`, { token: admin.token })).body;
const inCategory = async (slug: string, id: string) =>
  ((await api("GET", `/api/wallpapers?category=${slug}&limit=50`)).body.data as any[]).some((w) => w.id === id);

beforeAll(async () => {
  creator = await createUser("mc-creator");
  admin = await createUser("mc-admin");
  await makeAdmin(admin);
  const mk = async (s: string) => (await cats("", { name: `MC ${s} ${RUN_ID}`, slug: `${SLUG}-${s}` })).body as { id: string; slug: string };
  [primary, extraA, extraB, extraC] = [await mk("p"), await mk("a"), await mk("b"), await mk("c")];
});

useTestCleanup();
afterAll(async () => {
  const [real] = await sql<{ id: string }[]>`SELECT id FROM categories WHERE slug NOT LIKE 'aura-test-%' ORDER BY sort_order LIMIT 1`;
  await sql`UPDATE wallpapers SET category_id = ${real!.id} WHERE category_id IN (SELECT id FROM categories WHERE slug LIKE ${SLUG + "%"})`;
  await sql`DELETE FROM categories WHERE slug LIKE ${SLUG + "%"}`;
});

describe("extra categories", () => {
  it("are set by the admin, validated, listed on every category page, and follow primary changes", async () => {
    const w = await createTestWallpaper(creator, { status: "approved" });
    await sql`UPDATE wallpapers SET category_id = ${primary.id} WHERE id = ${w}`;

    expectError(await patch(w, { extraCategoryIds: [extraA.id, extraB.id, extraC.id] }), 400, "A wallpaper can have at most 2 extra categories.");
    expectError(await patch(w, { extraCategoryIds: ["00000000-0000-4000-8000-000000000000"] }), 400, "Category not found");

    // the primary in the list is ignored; order is kept
    const res = await patch(w, { extraCategoryIds: [extraA.id, primary.id, extraB.id] });
    expect(res.status).toBe(200);
    expect(res.body.extraCategories.map((c: any) => c.id)).toEqual([extraA.id, extraB.id]);
    const [log] = await sql`SELECT details FROM admin_actions WHERE target_id = ${w} AND action = 'wallpaper.update' ORDER BY created_at DESC LIMIT 1`;
    expect(log!.details.changes.extraCategoryIds).toEqual({ from: [], to: [extraA.id, extraB.id] });

    // public: on the primary page and both extra pages; detail lists the extras
    expect(await inCategory(primary.slug, w)).toBe(true);
    expect(await inCategory(extraA.slug, w)).toBe(true);
    expect(await inCategory(extraB.slug, w)).toBe(true);
    expect(await inCategory(extraC.slug, w)).toBe(false);
    expect((await api("GET", `/api/wallpapers/${w}`)).body.data.extraCategoryIds).toEqual([extraA.id, extraB.id]);
    // admin filter + counts include extras
    const filtered = (await api("GET", `/api/admin/wallpapers?categoryId=${extraB.id}&status=all`, { token: admin.token })).body.data as any[];
    expect(filtered.map((x) => x.id)).toContain(w);
    const adminCats = (await cats("", undefined, "GET")).body.data as any[];
    expect(adminCats.find((c) => c.id === extraB.id).live).toBe(1);
    const pubCats = (await api("GET", "/api/categories")).body.data as any[];
    expect(pubCats.find((c: any) => c.id === extraB.id).wallpaperCount).toBe(1);

    // making an extra the primary removes it from the extras
    const moved = await patch(w, { categoryId: extraA.id });
    expect(moved.body.category.id).toBe(extraA.id);
    expect(moved.body.extraCategories.map((c: any) => c.id)).toEqual([extraB.id]);

    // clearing
    expect((await patch(w, { extraCategoryIds: [] })).body.extraCategories).toEqual([]);
    expect(await inCategory(extraB.slug, w)).toBe(false);
  });

  it("a hidden extra category hides the wallpaper; deleting a category with moveTo moves extras too", async () => {
    const w = await createTestWallpaper(creator, { status: "approved" });
    await sql`UPDATE wallpapers SET category_id = ${primary.id} WHERE id = ${w}`;
    await patch(w, { extraCategoryIds: [extraC.id] });

    expect((await api("GET", `/api/wallpapers/${w}`)).status).toBe(200);
    await cats(`/${extraC.id}`, { isHidden: true }, "PATCH");
    try {
      expect((await api("GET", `/api/wallpapers/${w}`)).status).toBe(404);
      expect(await inCategory(primary.slug, w)).toBe(false); // hidden everywhere, not just on the hidden page
    } finally {
      await cats(`/${extraC.id}`, { isHidden: false }, "PATCH");
    }
    expect(await inCategory(primary.slug, w)).toBe(true);

    // delete extraC, moving its wallpapers to extraA → the extra becomes extraA
    const del = await cats(`/${extraC.id}?moveTo=${extraA.id}`, undefined, "DELETE");
    expect(del.status).toBe(200);
    expect((await detail(w)).extraCategories.map((c: any) => c.id)).toEqual([extraA.id]);
    // …and moving into the wallpaper's own primary doesn't duplicate it
    const w2 = await createTestWallpaper(creator, { status: "approved" });
    await sql`UPDATE wallpapers SET category_id = ${primary.id} WHERE id = ${w2}`;
    await patch(w2, { extraCategoryIds: [extraB.id] });
    await cats(`/${extraB.id}?moveTo=${primary.id}`, undefined, "DELETE");
    expect((await detail(w2)).extraCategories).toEqual([]);
  });
});
