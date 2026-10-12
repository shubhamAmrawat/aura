import { beforeAll, describe, expect, it } from "vitest";
import { api } from "../setup/http";
import { sql } from "../setup/db";
import { createUser, makeAdmin, type TestUser } from "../setup/auth";
import { createTestWallpaper } from "../setup/fixtures";
import { expectError } from "../setup/assert";
import { useTestCleanup } from "../setup/lifecycle";

useTestCleanup(); // test wallpapers are deleted → their suggestion rows cascade

let viewer: TestUser;
let admin: TestUser;
let catA: string;
let catB: string;

beforeAll(async () => {
  viewer = await createUser("sug-viewer");
  admin = await createUser("sug-admin");
  await makeAdmin(admin);
  const cats = await sql<{ id: string }[]>`SELECT id FROM categories WHERE slug <> 'uncategorized' ORDER BY sort_order LIMIT 2`;
  catA = cats[0]!.id;
  catB = cats[1]!.id;
});

/** A pending test wallpaper with a suggestion row. */
async function seed(opts: { current: string | null; suggested: string | null; fits: boolean | null }) {
  const id = await createTestWallpaper(admin);
  if (opts.current) await sql`UPDATE wallpapers SET category_id = ${opts.current} WHERE id = ${id}`;
  await sql`INSERT INTO category_suggestions (wallpaper_id, current_category_id, suggested_category_id, confidence, current_fits, reason, model)
            VALUES (${id}, ${opts.current}, ${opts.suggested}, 0.9, ${opts.fits}, 'test', 'test')`;
  return id;
}
const call = (method: string, path: string, json?: unknown, token = admin.token) =>
  api(method, `/api/admin/categories/suggestions${path}`, { token, json });

describe("category suggestions", () => {
  it("needs an admin", async () => {
    expectError(await api("GET", "/api/admin/categories/suggestions"), 401, "Unauthorized");
    expectError(await call("GET", "", undefined, viewer.token), 403, "Admin access required.");
    expectError(await call("POST", "/apply", { items: [] }, viewer.token), 403, "Admin access required.");
  });

  it("lists by kind with counts; validates kind", async () => {
    const u = await seed({ current: null, suggested: catA, fits: null });
    const m = await seed({ current: catA, suggested: catB, fits: false });
    const ok = await seed({ current: catA, suggested: catB, fits: true }); // current is fine → not a move

    expectError(await call("GET", "?kind=nope"), 400, "kind must be uncategorized or moves");
    const unc = await call("GET", "?kind=uncategorized");
    expect(unc.status).toBe(200);
    const row = unc.body.data.find((r: any) => r.wallpaperId === u);
    expect(row).toMatchObject({ current: null, suggested: { id: catA }, alternative: null, confidence: 0.9, reason: "test" });
    expect(unc.body.data.some((r: any) => r.wallpaperId === m || r.wallpaperId === ok)).toBe(false);

    const moves = await call("GET", "?kind=moves");
    expect(moves.body.data.find((r: any) => r.wallpaperId === m)).toMatchObject({ current: { id: catA }, suggested: { id: catB } });
    expect(moves.body.data.some((r: any) => r.wallpaperId === ok)).toBe(false);
    expect(moves.body.counts.uncategorized).toBeGreaterThanOrEqual(1);
    expect(moves.body.counts.moves).toBeGreaterThanOrEqual(1);
  });

  it("apply moves the wallpaper (any chosen category), marks it applied, audits; twice = skipped", async () => {
    const id = await seed({ current: null, suggested: catA, fits: null });
    const [before] = await sql`SELECT category_id FROM wallpapers WHERE id = ${id}`; // fixture's default category
    expectError(await call("POST", "/apply", { items: [] }), 400, "Select at least one wallpaper.");
    expectError(await call("POST", "/apply", { items: [{ wallpaperId: id, categoryId: "x" }] }), 400, "Choose a category");
    expectError(await call("POST", "/apply", { items: [{ wallpaperId: id, categoryId: catA }, { wallpaperId: id, categoryId: catB }] }), 400, "The list contains duplicates.");
    expectError(
      await call("POST", "/apply", { items: [{ wallpaperId: id, categoryId: "00000000-0000-4000-8000-000000000000" }] }),
      400, "One of the chosen categories no longer exists. Refresh and try again."
    );

    // admin overrides the AI's pick with catB
    const res = await call("POST", "/apply", { items: [{ wallpaperId: id, categoryId: catB }] });
    expect(res.body).toEqual({ applied: 1, skipped: 0 });
    const [w] = await sql`SELECT category_id FROM wallpapers WHERE id = ${id}`;
    expect(w!.category_id).toBe(catB);
    const [s] = await sql`SELECT status, resolved_by FROM category_suggestions WHERE wallpaper_id = ${id}`;
    expect(s).toMatchObject({ status: "applied", resolved_by: admin.id });
    const [a] = await sql`SELECT details FROM admin_actions WHERE admin_id = ${admin.id} AND action = 'category.suggestions.apply' ORDER BY created_at DESC LIMIT 1`;
    expect(a!.details.moves).toEqual([{ id, from: before!.category_id, to: catB }]);

    expect((await call("POST", "/apply", { items: [{ wallpaperId: id, categoryId: catA }] })).body).toEqual({ applied: 0, skipped: 1 });
    const [w2] = await sql`SELECT category_id FROM wallpapers WHERE id = ${id}`;
    expect(w2!.category_id).toBe(catB);
  });

  it("dismiss hides a suggestion without touching the wallpaper", async () => {
    const id = await seed({ current: catA, suggested: catB, fits: false });
    expect((await call("POST", "/dismiss", { wallpaperIds: [id] })).body).toEqual({ dismissed: 1 });
    expect((await call("POST", "/dismiss", { wallpaperIds: [id] })).body).toEqual({ dismissed: 0 });
    const [w] = await sql`SELECT category_id FROM wallpapers WHERE id = ${id}`;
    expect(w!.category_id).toBe(catA);
    const moves = await call("GET", "?kind=moves");
    expect(moves.body.data.some((r: any) => r.wallpaperId === id)).toBe(false);
  });
});
