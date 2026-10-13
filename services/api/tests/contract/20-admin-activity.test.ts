import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api } from "../setup/http";
import { sql } from "../setup/db";
import { createUser, makeAdmin, type TestUser } from "../setup/auth";
import { expectError } from "../setup/assert";
import { useTestCleanup } from "../setup/lifecycle";
import { RUN_ID } from "../setup/run";

useTestCleanup(); // removes this run's users and every admin_actions row they wrote
afterAll(async () => { await sql`DELETE FROM categories WHERE slug LIKE ${"aura-test-" + RUN_ID.toLowerCase() + "%"}`; });

let admin: TestUser;
let viewer: TestUser;
let catId: string;
const SLUG = `aura-test-${RUN_ID.toLowerCase()}-act`;
let startedAt: string;

beforeAll(async () => {
  startedAt = new Date(Date.now() - 1000).toISOString();
  admin = await createUser("act-admin");
  viewer = await createUser("act-viewer");
  await makeAdmin(admin);
  const t = admin.token;
  // a few real actions to read back
  const c = await api("POST", "/api/admin/categories", { token: t, json: { name: `Act ${RUN_ID}`, slug: SLUG } });
  catId = c.body.id;
  await api("PATCH", `/api/admin/categories/${catId}`, { token: t, json: { description: "first" } });
  await api("PATCH", `/api/admin/users/${viewer.id}`, { token: t, json: { isCreator: true } });
  const gone = await api("POST", "/api/admin/categories", { token: t, json: { name: `Act gone ${RUN_ID}`, slug: `${SLUG}-gone` } });
  await api("DELETE", `/api/admin/categories/${gone.body.id}`, { token: t });
});

const list = (qs = "", token = admin.token) => api("GET", `/api/admin/activity${qs}`, { token });

describe("GET /api/admin/activity", () => {
  it("needs an admin; validates", async () => {
    expectError(await api("GET", "/api/admin/activity"), 401, "Unauthorized");
    expectError(await list("", viewer.token), 403, "Admin access required.");
    expectError(await list("?group=nope"), 400, "Invalid group");
    expectError(await list("?adminId=nope"), 400, "Invalid admin");
    expectError(await list("?from=yesterday"), 400, "from must be a date");
  });

  it("newest first, with the admin and current target names", async () => {
    const res = await list(`?adminId=${admin.id}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(5);
    const actions = res.body.data.map((r: any) => r.action);
    expect(actions).toEqual(["category.delete", "category.create", "user.creator.grant", "category.update", "category.create"]);
    for (let i = 1; i < res.body.data.length; i++) expect(res.body.data[i - 1].createdAt >= res.body.data[i].createdAt).toBe(true);
    const upd = res.body.data.find((r: any) => r.action === "category.update");
    expect(upd).toMatchObject({ admin: { id: admin.id, email: admin.email }, targetType: "category", targetId: catId, category: { name: `Act ${RUN_ID}`, slug: SLUG }, wallpaper: null, user: null });
    expect(upd.details.changes.description).toEqual({ from: null, to: "first" });
    const grant = res.body.data.find((r: any) => r.action === "user.creator.grant");
    expect(grant.user).toEqual({ email: viewer.email, username: viewer.username });
    // a deleted target: no join row, but its details keep the name
    const del = res.body.data.find((r: any) => r.action === "category.delete");
    expect(del.category).toBeNull();
    expect(del.details.name).toBe(`Act gone ${RUN_ID}`);
    expect(res.body.admins.some((a: any) => a.id === admin.id)).toBe(true);
    expect(res.body.categoryNames[catId]).toBe(`Act ${RUN_ID}`);
  });

  it("filters: group, search (also by current target name), date range, paging", async () => {
    const mine = `adminId=${admin.id}`;
    expect((await list(`?${mine}&group=categories`)).body.total).toBe(4);
    expect((await list(`?${mine}&group=users`)).body.data.map((r: any) => r.action)).toEqual(["user.creator.grant"]);
    expect((await list(`?${mine}&group=review`)).body.total).toBe(0);
    expect((await list(`?${mine}&q=${encodeURIComponent(viewer.email)}`)).body.total).toBe(1);
    // "Act <run>": its create (details) + its update (only the joined current name matches)
    expect((await list(`?${mine}&q=${encodeURIComponent(`Act ${RUN_ID}`)}`)).body.data.map((r: any) => r.action)).toEqual(["category.update", "category.create"]); // newest first
    // a deleted category is still findable through the details kept in the log
    expect((await list(`?${mine}&q=${encodeURIComponent(`Act gone ${RUN_ID}`)}`)).body.data.map((r: any) => r.action)).toEqual(["category.delete", "category.create"]);
    expect((await list(`?${mine}&from=${encodeURIComponent(startedAt)}`)).body.total).toBe(5);
    expect((await list(`?${mine}&to=${encodeURIComponent(startedAt)}`)).body.total).toBe(0);
    const p1 = await list(`?${mine}&limit=2`);
    const p2 = await list(`?${mine}&limit=2&offset=2`);
    expect(p1.body.hasMore).toBe(true);
    expect([...p1.body.data, ...p2.body.data].map((r: any) => r.id)).toEqual((await list(`?${mine}&limit=4`)).body.data.map((r: any) => r.id));
  });
});
