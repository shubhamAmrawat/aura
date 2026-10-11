import { beforeAll, describe, expect, it } from "vitest";
import { api } from "../setup/http";
import { sql } from "../setup/db";
import { createUser, makeAdmin, type TestUser } from "../setup/auth";
import { createTestWallpaper } from "../setup/fixtures";
import { expectError, expectKeys, NONEXISTENT_UUID } from "../setup/assert";
import { useTestCleanup } from "../setup/lifecycle";

useTestCleanup();

let creator: TestUser;
let user: TestUser;
let admin: TestUser;
let catA: string;
let catB: string;

const list = (q: string, token = admin.token) => api("GET", `/api/admin/wallpapers${q}`, { token });
const patch = (id: string, json: unknown, token = admin.token) => api("PATCH", `/api/admin/wallpapers/${id}`, { token, json });
const bulk = (json: unknown) => api("POST", "/api/admin/wallpapers/bulk", { token: admin.token, json });
const row = async (id: string) =>
  (await sql`SELECT title, description, tags, category_id, is_featured, is_premium, is_mobile, is_ai_generated, text_embedding IS NOT NULL AS has_text FROM wallpapers WHERE id = ${id}`)[0];
const audits = async (id: string) =>
  await sql<{ action: string; admin_id: string; details: any }[]>`SELECT action, admin_id, details FROM admin_actions WHERE target_id = ${id} ORDER BY created_at`;

beforeAll(async () => {
  [creator, user, admin] = await Promise.all([createUser("wm-creator"), createUser("wm-user"), createUser("wm-admin")]);
  await makeAdmin(admin);
  const cats = await sql<{ id: string }[]>`SELECT id FROM categories ORDER BY sort_order LIMIT 2`;
  [catA, catB] = [cats[0]!.id, cats[1]!.id];
});

describe("guard + validation", () => {
  it("normal users get 403 everywhere", async () => {
    const id = await createTestWallpaper(creator);
    expectError(await list("", user.token), 403, "Admin access required.");
    expectError(await api("GET", `/api/admin/wallpapers/${id}`, { token: user.token }), 403, "Admin access required.");
    expectError(await patch(id, { title: "x" }, user.token), 403, "Admin access required.");
    expectError(await api("DELETE", `/api/admin/wallpapers/${id}`, { token: user.token }), 403, "Admin access required.");
    expectError(await api("POST", "/api/admin/wallpapers/bulk", { token: user.token, json: { ids: [id], action: "feature" } }), 403, "Admin access required.");
  });

  it("rejects bad list params", async () => {
    expectError(await list("?status=live"), 400, "Invalid status");
    expectError(await list("?sort=random"), 400, "Invalid sort");
    expectError(await list("?featured=yes"), 400, "featured must be true or false");
    expectError(await list("?categoryId=abc"), 400, "Invalid category");
    expect((await list("?limit=101")).status).toBe(400);
    expectError(await list("?resolution=8k"), 400, "Invalid resolution");
  });
});

describe("GET /api/admin/wallpapers", () => {
  it("lists every status with uploader + category", async () => {
    const pending = await createTestWallpaper(creator, { status: "pending" });
    const res = await list(`?q=${encodeURIComponent(creator.username)}&limit=100`);
    expect(res.status).toBe(200);
    expectKeys(res.body, ["data", "total", "hasMore"]);
    const item = res.body.data.find((w: { id: string }) => w.id === pending);
    expect(item).toBeTruthy();
    expectKeys(item, [
      "id", "title", "fileUrl", "dominantColor", "width", "height", "fileSizeBytes", "format", "status", "tags",
      "isFeatured", "isPremium", "isMobile", "isAiGenerated", "downloadCount", "likeCount", "viewCount", "trendingScore",
      "createdAt", "category", "uploader",
    ]);
    expect(item.status).toBe("pending");
    expect(item.uploader).toEqual({ id: creator.id, username: creator.username });
    expectKeys(item.category, ["id", "name"]);
  });

  it("filters: status, uploader, category none, flags; pagination", async () => {
    const a = await createTestWallpaper(creator, { status: "approved" });
    const b = await createTestWallpaper(creator, { status: "approved" });
    await sql`UPDATE wallpapers SET category_id = NULL, is_featured = true, is_premium = true WHERE id = ${a}`;
    const ids = (r: any) => r.body.data.map((w: { id: string }) => w.id);

    const byUploader = await list(`?uploader=${creator.username}&status=approved&limit=100`);
    expect(ids(byUploader)).toEqual(expect.arrayContaining([a, b]));
    expect(byUploader.body.data.every((w: any) => w.status === "approved" && w.uploader.username === creator.username)).toBe(true);

    const noCat = await list(`?uploader=${creator.username}&categoryId=none`);
    expect(ids(noCat)).toEqual([a]);
    const feat = await list(`?uploader=${creator.username}&featured=true&premium=true`);
    expect(ids(feat)).toEqual([a]);
    const notFeat = await list(`?uploader=${creator.username}&featured=false&status=approved`);
    expect(ids(notFeat)).toContain(b);
    expect(ids(notFeat)).not.toContain(a);

    const page1 = await list(`?uploader=${creator.username}&limit=1&sort=oldest`);
    const page2 = await list(`?uploader=${creator.username}&limit=1&offset=1&sort=oldest`);
    expect(page1.body.hasMore).toBe(true);
    expect(page1.body.data[0].id).not.toBe(page2.body.data[0].id);

    const all = await list("?limit=1");
    const [{ n }] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM wallpapers`;
    expect(all.body.total).toBe(n);
  });

  it("sorts by downloads (desc) and finds by exact id", async () => {
    const low = await createTestWallpaper(creator, { status: "approved" });
    const high = await createTestWallpaper(creator, { status: "approved" });
    await sql`UPDATE wallpapers SET download_count = 5 WHERE id = ${low}`;
    await sql`UPDATE wallpapers SET download_count = 50 WHERE id = ${high}`;
    const res = await list(`?uploader=${creator.username}&sort=downloads&limit=100`);
    const order = res.body.data.map((w: { id: string }) => w.id);
    expect(order.indexOf(high)).toBeLessThan(order.indexOf(low));
    expect((await list(`?q=${low}`)).body.data.map((w: { id: string }) => w.id)).toEqual([low]);
  });
});

describe("resolution filter (longer edge)", () => {
  it("4k / qhd / fhd / hd / low tiers", async () => {
    const sizes: Record<string, [number, number]> = { "4k": [2160, 3840], qhd: [1440, 2560], fhd: [1080, 1920], hd: [1280, 720], low: [720, 1000] };
    const ids: Record<string, string> = {};
    for (const [tier, [w, h]] of Object.entries(sizes)) {
      ids[tier] = await createTestWallpaper(creator);
      await sql`UPDATE wallpapers SET width = ${w}, height = ${h} WHERE id = ${ids[tier]}`;
    }
    for (const tier of Object.keys(sizes)) {
      const res = await list(`?uploader=${creator.username}&resolution=${tier}&limit=100`);
      const got = res.body.data.map((w: { id: string }) => w.id);
      expect(got).toContain(ids[tier]);
      for (const other of Object.keys(sizes)) if (other !== tier) expect(got).not.toContain(ids[other]);
    }
    // DB-wide: tiers add up to the total
    let sum = 0;
    for (const tier of Object.keys(sizes)) sum += (await list(`?resolution=${tier}&limit=1`)).body.total;
    expect(sum).toBe((await list("?limit=1")).body.total);
  });
});

describe("GET /api/admin/wallpapers/:id", () => {
  it("returns the full detail incl. review + embedding info", async () => {
    const id = await createTestWallpaper(creator, { status: "pending" });
    const res = await api("GET", `/api/admin/wallpapers/${id}`, { token: admin.token });
    expect(res.status).toBe(200);
    for (const k of ["description", "palette", "moderationReason", "reviewNote", "reviewedAt", "rejectedAt", "updatedAt", "hasVisionEmbedding", "hasTextEmbedding", "uploader", "category"]) {
      expect(res.body).toHaveProperty(k);
    }
    expect(res.body.hasTextEmbedding).toBe(true);
    expectError(await api("GET", `/api/admin/wallpapers/${NONEXISTENT_UUID}`, { token: admin.token }), 404, "Wallpaper not found");
    expectError(await api("GET", "/api/admin/wallpapers/nope", { token: admin.token }), 400, "Invalid wallpaper id");
  });
});

describe("PATCH /api/admin/wallpapers/:id", () => {
  it("validates", async () => {
    const id = await createTestWallpaper(creator);
    expectError(await patch(id, {}), 400, "Nothing to update");
    expectError(await patch(id, { title: "   " }), 400, "Title is required");
    expectError(await patch(id, { isFeatured: "yes" }), 400, "isFeatured must be true or false");
    expectError(await patch(id, { categoryId: NONEXISTENT_UUID }), 400, "Category not found");
    expectError(await patch(id, { tags: Array(31).fill("t") }), 400, "At most 30 tags");
    expect((await patch(id, { status: "approved" })).status).toBe(400);
    expectError(await patch(NONEXISTENT_UUID, { title: "x" }), 404, "Wallpaper not found");
  });

  it("updates only what changed, logs the diff, re-creates the search embedding", async () => {
    const id = await createTestWallpaper(creator, { status: "approved" });
    await sql`UPDATE wallpapers SET text_embedding = NULL, category_id = ${catA} WHERE id = ${id}`;
    const res = await patch(id, {
      title: "  Edited title  ",
      description: "",
      tags: [" Sunset ", "sunset", "Beach", ""],
      categoryId: catB,
      isFeatured: true,
      isMobile: true, // unchanged (fixture is mobile)
    });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Edited title");
    expect(res.body.tags).toEqual(["Sunset", "Beach"]);
    expect(res.body.category.id).toBe(catB);

    const r = await row(id);
    expect(r).toMatchObject({ title: "Edited title", description: null, tags: ["Sunset", "Beach"], category_id: catB, is_featured: true, is_mobile: true });

    const log = await audits(id);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ action: "wallpaper.update", admin_id: admin.id });
    expect(Object.keys(log[0]!.details.changes).sort()).toEqual(["categoryId", "description", "isFeatured", "tags", "title"]);
    expect(log[0]!.details.changes.isFeatured).toEqual({ from: false, to: true });

    let has = false;
    for (let i = 0; i < 20 && !has; i++) {
      await new Promise((r) => setTimeout(r, 500));
      has = (await row(id))!.has_text;
    }
    expect(has).toBe(true);

    // no-op edit: 200, nothing logged
    expect((await patch(id, { isFeatured: true })).status).toBe(200);
    expect(await audits(id)).toHaveLength(1);
  });

  it("can clear the category", async () => {
    const id = await createTestWallpaper(creator);
    const res = await patch(id, { categoryId: null });
    expect(res.body.category).toBeNull();
  });
});

describe("DELETE /api/admin/wallpapers/:id", () => {
  it("deletes the wallpaper and its likes; logs it", async () => {
    const id = await createTestWallpaper(creator, { status: "approved" });
    await sql`INSERT INTO likes (user_id, wallpaper_id) VALUES (${user.id}, ${id})`;
    const res = await api("DELETE", `/api/admin/wallpapers/${id}`, { token: admin.token });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id, deleted: true });
    expect((await sql`SELECT 1 FROM wallpapers WHERE id = ${id}`).length).toBe(0);
    expect((await sql`SELECT 1 FROM likes WHERE wallpaper_id = ${id}`).length).toBe(0);
    expect((await audits(id)).map((a) => a.action)).toEqual(["wallpaper.delete"]);
    expectError(await api("DELETE", `/api/admin/wallpapers/${id}`, { token: admin.token }), 404, "Wallpaper not found");
  });
});

describe("POST /api/admin/wallpapers/bulk", () => {
  it("validates", async () => {
    const id = await createTestWallpaper(creator);
    expectError(await bulk({ ids: [], action: "feature" }), 400, "Select at least one wallpaper.");
    expectError(await bulk({ ids: [id], action: "explode" }), 400, "Invalid action");
    expectError(await bulk({ ids: [id], action: "setCategory" }), 400, "Choose a category.");
    expectError(await bulk({ ids: [id], action: "addTags", tags: [] }), 400, "Enter at least one tag.");
    expectError(await bulk({ ids: [id], action: "setCategory", categoryId: NONEXISTENT_UUID }), 400, "Category not found");
  });

  it("feature, category, tags, delete — with per-item results", async () => {
    const [a, b] = await Promise.all([createTestWallpaper(creator, { tags: ["old", "Keep"] }), createTestWallpaper(creator, { tags: ["keep"] })]);

    const f = await bulk({ ids: [a, b, NONEXISTENT_UUID], action: "feature" });
    expect(f.body).toMatchObject({ action: "feature", succeeded: 2, failed: 1 });
    expect(f.body.results).toContainEqual({ id: NONEXISTENT_UUID, ok: false, error: "Wallpaper not found" });
    expect((await row(a))!.is_featured).toBe(true);

    expect((await bulk({ ids: [a, b], action: "setCategory", categoryId: catB })).body.succeeded).toBe(2);
    expect((await row(b))!.category_id).toBe(catB);

    await bulk({ ids: [a, b], action: "addTags", tags: ["New", "KEEP"] });
    expect((await row(a))!.tags).toEqual(["old", "Keep", "New"]);
    expect((await row(b))!.tags).toEqual(["keep", "New"]);

    await bulk({ ids: [a, b], action: "removeTags", tags: ["keep"] });
    expect((await row(a))!.tags).toEqual(["old", "New"]);
    expect((await row(b))!.tags).toEqual(["New"]);

    expect((await bulk({ ids: [a, b], action: "unfeature" })).body.succeeded).toBe(2);
    const del = await bulk({ ids: [a, b], action: "delete" });
    expect(del.body).toMatchObject({ succeeded: 2, failed: 0 });
    expect((await sql`SELECT 1 FROM wallpapers WHERE id = ANY(${[a, b]}::uuid[])`).length).toBe(0);
  });
});
