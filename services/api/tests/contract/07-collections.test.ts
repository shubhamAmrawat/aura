import { beforeAll, describe, expect, it } from "vitest";
import { api } from "../setup/http";
import { sql } from "../setup/db";
import { createUser, type TestUser } from "../setup/auth";
import { createTestWallpaper } from "../setup/fixtures";
import { expectError, expectKeys, NONEXISTENT_UUID } from "../setup/assert";
import { useTestCleanup } from "../setup/lifecycle";

useTestCleanup();

const COLLECTION_ROW = ["id", "userId", "title", "description", "isPublic", "coverWallpaperId", "createdAt"];

let owner: TestUser;
let other: TestUser;
let wp1: string;
let wp2: string;

beforeAll(async () => {
  owner = await createUser("col-owner");
  other = await createUser("col-other");
  wp1 = await createTestWallpaper(owner);
  wp2 = await createTestWallpaper(owner);
});

describe("public + auth guards", () => {
  it("GET /public lists public collections with counts", async () => {
    const res = await api("GET", "/api/collections/public");
    expect(res.status).toBe(200);
    expectKeys(res.body, ["data"]);
    const ids = res.body.data.map((c: any) => c.id);
    for (const c of res.body.data) {
      expectKeys(c, ["id", "title", "description", "coverWallpaperId", "userId", "createdAt", "wallpaperCount"]);
      expect(typeof c.wallpaperCount).toBe("number");
    }
    if (ids.length) {
      const priv = await sql`SELECT 1 FROM collections WHERE id = ANY(${ids}::uuid[]) AND is_public = false`;
      expect(priv.length).toBe(0);
    }
  });

  it("owner routes require auth", async () => {
    expectError(await api("GET", "/api/collections"), 401, "Unauthorized");
    expectError(await api("POST", "/api/collections", { json: { title: "x" } }), 401, "Unauthorized");
    expectError(await api("GET", "/api/collections/saved-ids"), 401, "Unauthorized");
    expectError(await api("GET", `/api/collections/check/${wp1}`), 401, "Unauthorized");
    expectError(await api("PUT", `/api/collections/${NONEXISTENT_UUID}`, { json: {} }), 401, "Unauthorized");
    expectError(await api("DELETE", `/api/collections/${NONEXISTENT_UUID}`), 401, "Unauthorized");
  });
});

describe("collection lifecycle", () => {
  let colId: string;

  it("create: title required, trimmed, private by default", async () => {
    expectError(await api("POST", "/api/collections", { token: owner.token, json: { title: "   " } }), 400, "Collection title is required");
    const res = await api("POST", "/api/collections", { token: owner.token, json: { title: "  My Col  ", description: "  desc " } });
    expect(res.status).toBe(200);
    expectKeys(res.body, ["collection"]);
    expectKeys(res.body.collection, COLLECTION_ROW);
    expect(res.body.collection).toMatchObject({ title: "My Col", description: "desc", isPublic: false, userId: owner.id, coverWallpaperId: null });
    colId = res.body.collection.id;
  });

  it("list own collections", async () => {
    const res = await api("GET", "/api/collections", { token: owner.token });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expectKeys(res.body.data[0], ["id", "title", "description", "isPublic", "coverWallpaperId", "coverUrl", "createdAt", "wallpaperCount"]);
    expect(res.body.data[0]).toMatchObject({ id: colId, wallpaperCount: 0, coverUrl: null });
    expect((await api("GET", "/api/collections", { token: other.token })).body).toEqual({ data: [] });
  });

  it("update: owner only", async () => {
    expectError(await api("PUT", `/api/collections/${colId}`, { token: other.token, json: { title: "hack" } }), 404, "Collection not found");
    const res = await api("PUT", `/api/collections/${colId}`, { token: owner.token, json: { title: " Renamed ", isPublic: false } });
    expect(res.status).toBe(200);
    expectKeys(res.body.collection, COLLECTION_ROW);
    expect(res.body.collection.title).toBe("Renamed");
  });

  it("add wallpapers: validation, ownership, cover, duplicates", async () => {
    expectError(await api("POST", `/api/collections/${colId}/wallpapers`, { token: owner.token, json: {} }), 400, "wallpaperId is required");
    expectError(await api("POST", `/api/collections/${colId}/wallpapers`, { token: other.token, json: { wallpaperId: wp1 } }), 404, "Collection not found");
    const add = await api("POST", `/api/collections/${colId}/wallpapers`, { token: owner.token, json: { wallpaperId: wp1 } });
    expect(add.status).toBe(200);
    expect(add.body).toEqual({ message: "Wallpaper added to collection" });
    expectError(await api("POST", `/api/collections/${colId}/wallpapers`, { token: owner.token, json: { wallpaperId: wp1 } }), 409, "Wallpaper already in collection");
    await api("POST", `/api/collections/${colId}/wallpapers`, { token: owner.token, json: { wallpaperId: wp2 } });
    const [c] = await sql<{ cover: string }[]>`SELECT cover_wallpaper_id AS cover FROM collections WHERE id = ${colId}`;
    expect(c!.cover).toBe(wp1);
  });

  it("saved-ids and check", async () => {
    const saved = await api("GET", "/api/collections/saved-ids", { token: owner.token });
    expect(saved.status).toBe(200);
    expect([...saved.body.data].sort()).toEqual([wp1, wp2].sort());
    const check = await api("GET", `/api/collections/check/${wp1}`, { token: owner.token });
    expect(check.status).toBe(200);
    expect(check.body.data).toEqual([{ id: colId, title: "Renamed", isPublic: false, hasWallpaper: true }]);
    const check2 = await api("GET", `/api/collections/check/${NONEXISTENT_UUID}`, { token: owner.token });
    expect(check2.body.data[0].hasWallpaper).toBe(false);
  });

  it("GET /:id private: owner only (401 otherwise)", async () => {
    expectError(await api("GET", `/api/collections/${colId}`), 401, "Unauthorized");
    expectError(await api("GET", `/api/collections/${colId}`, { token: "bad" }), 401, "Unauthorized");
    expectError(await api("GET", `/api/collections/${colId}`, { token: other.token }), 401, "Unauthorized");
    const res = await api("GET", `/api/collections/${colId}`, { cookie: owner.cookie });
    expect(res.status).toBe(200);
    expectKeys(res.body, ["collection", "wallpapers"]);
    expectKeys(res.body.collection, [...COLLECTION_ROW, "wallpaperCount"]);
    expect(res.body.collection.wallpaperCount).toBe(2);
    for (const w of res.body.wallpapers) {
      expectKeys(w, ["id", "title", "fileUrl", "thumbUrl", "blurhash", "dominantColor", "width", "height", "likeCount", "downloadCount", "addedAt"]);
    }
  });

  it("GET /:id public: anyone; unknown → 404", async () => {
    await api("PUT", `/api/collections/${colId}`, { token: owner.token, json: { isPublic: true } });
    const res = await api("GET", `/api/collections/${colId}`);
    expect(res.status).toBe(200);
    expect(res.body.collection.isPublic).toBe(true);
    expectError(await api("GET", `/api/collections/${NONEXISTENT_UUID}`), 404, "Collection not found");
  });

  it("remove wallpapers: cover moves to next, then null", async () => {
    expectError(await api("DELETE", `/api/collections/${colId}/wallpapers/${wp1}`, { token: other.token }), 404, "Collection not found");
    const r1 = await api("DELETE", `/api/collections/${colId}/wallpapers/${wp1}`, { token: owner.token });
    expect(r1.body).toEqual({ message: "Wallpaper removed from collection" });
    let [c] = await sql<{ cover: string | null }[]>`SELECT cover_wallpaper_id AS cover FROM collections WHERE id = ${colId}`;
    expect(c!.cover).toBe(wp2);
    await api("DELETE", `/api/collections/${colId}/wallpapers/${wp2}`, { token: owner.token });
    [c] = await sql<{ cover: string | null }[]>`SELECT cover_wallpaper_id AS cover FROM collections WHERE id = ${colId}`;
    expect(c!.cover).toBeNull();
  });

  it("delete: owner only, removes items", async () => {
    await api("POST", `/api/collections/${colId}/wallpapers`, { token: owner.token, json: { wallpaperId: wp1 } });
    expectError(await api("DELETE", `/api/collections/${colId}`, { token: other.token }), 404, "Collection not found");
    const res = await api("DELETE", `/api/collections/${colId}`, { token: owner.token });
    expect(res.body).toEqual({ message: "Collection deleted successfully" });
    expect((await sql`SELECT 1 FROM collections WHERE id = ${colId}`).length).toBe(0);
    expect((await sql`SELECT 1 FROM collection_wallpapers WHERE collection_id = ${colId}`).length).toBe(0);
  });
});
