import { beforeAll, describe, expect, it } from "vitest";
import { api } from "../setup/http";
import { sql } from "../setup/db";
import { createUser, makeCreator, type TestUser } from "../setup/auth";
import { pngOf } from "../setup/images";
import { expectError } from "../setup/assert";
import { useTestCleanup } from "../setup/lifecycle";

useTestCleanup();

let viewer: TestUser;
let ana: TestUser;
let ben: TestUser;
let categoryId: string;

beforeAll(async () => {
  [viewer, ana, ben] = await Promise.all([createUser("st-viewer"), createUser("st-ana"), createUser("st-ben")]);
  await Promise.all([makeCreator(ana), makeCreator(ben)]);
  const [cat] = await sql<{ id: string }[]>`SELECT id FROM categories WHERE is_hidden = false ORDER BY sort_order LIMIT 1`;
  categoryId = cat!.id;
});

/** Signed URL → PUT, as the upload page does. */
async function stage(user: TestUser, bytes: Buffer) {
  const url = await api("POST", "/api/wallpapers/upload-url", { token: user.token, json: { fileType: "image/png" } });
  expect(url.status).toBe(200);
  const put = await fetch(url.body.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/png" }, body: new Uint8Array(bytes) });
  expect(put.status).toBe(200);
  return { key: url.body.key as string, fileUrl: url.body.fileUrl as string, fileType: "image/png", fileSizeBytes: bytes.length };
}

const prepare = (user: TestUser, f: object) => api("POST", "/api/wallpapers/upload/prepare", { token: user.token, json: f });
const publish = (user: TestUser, f: { key: string; fileUrl: string; fileSizeBytes: number }, title = "Studio Upload") =>
  api("POST", "/api/wallpapers/upload", { token: user.token, json: { ...f, title, categoryId, tags: ["test"] } });

/** Keep anything a test publishes off the public site. */
async function hide(id: string | undefined) {
  if (id) await sql`UPDATE wallpapers SET status = 'pending' WHERE id = ${id}`;
}

describe("upload studio: prepare → publish, with duplicate detection", () => {
  const original = pngOf(1200, 2000);

  it("only creators can prepare", async () => {
    expectError(await api("POST", "/api/wallpapers/upload/prepare", { json: {} }), 401, "Unauthorized");
    expectError(await prepare(viewer, { key: "x", fileUrl: "x", fileType: "image/png", fileSizeBytes: 1 }), 403, "Only creators can upload wallpapers");
  });

  it("refuses images under 1080 px on the short side and deletes them", async () => {
    const f = await stage(ana, await pngOf(800, 1400));
    expectError(await prepare(ana, f), 400, "This image is 800 × 1400. Use at least 1080 px on the short side so it looks sharp on phones.");
    expect((await fetch(`${f.fileUrl}?nocache=${Date.now()}`)).status).toBe(404);
  });

  let firstId: string;
  it("prepare returns preview data + AI suggestions; publish reuses them and stores the fingerprint", async () => {
    const f = await stage(ana, await original);
    const res = await prepare(ana, f);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ key: f.key, width: 1200, height: 2000, isMobile: true, similarTo: null });
    expect(res.body.thumbUrl).toMatch(/^https:\/\//);
    expect(res.body.suggestions).toEqual(expect.objectContaining({ tags: expect.any(Array), extraCategoryIds: expect.any(Array) }));
    // calling it again returns the same draft (no second AI run)
    expect((await prepare(ana, f)).body).toEqual(res.body);

    const pub = await publish(ana, f);
    expect(pub.status).toBe(200);
    firstId = pub.body.wallpaper.id;
    await hide(firstId);
    expect(pub.body.similarTo).toBeNull();
    const [row] = await sql`SELECT phash, width, height FROM wallpapers WHERE id = ${firstId}`;
    expect(row!.phash).not.toBeNull();
    expect(row).toMatchObject({ width: 1200, height: 2000 });
    const [draft] = await sql`SELECT 1 FROM upload_drafts WHERE key = ${f.key}`;
    expect(draft).toBeUndefined();
  });

  it("the same picture again is blocked — for the same creator and for anyone else", async () => {
    const again = await stage(ana, await original);
    const mine = await prepare(ana, again);
    expect(mine.status).toBe(409);
    expect(mine.body.error).toBe("You’ve already uploaded this wallpaper (“Studio Upload”).");
    expect(mine.body.duplicate).toMatchObject({ id: firstId, title: "Studio Upload", yours: true });
    expect((await fetch(`${again.fileUrl}?nocache=${Date.now()}`)).status).toBe(404);

    const theirs = await prepare(ben, await stage(ben, await original));
    expect(theirs.status).toBe(409);
    expect(theirs.body.error).toBe(`This wallpaper is already on Aurora (“Studio Upload” by @${ana.username}).`);
    expect(theirs.body.duplicate).toMatchObject({ id: firstId, yours: false, by: ana.username });
  });

  it("skipping prepare doesn't skip the check", async () => {
    const f = await stage(ben, await original);
    const res = await publish(ben, f, "Sneaky copy");
    expect(res.status).toBe(409);
    expect(res.body.duplicate).toMatchObject({ id: firstId });
  });

  it("a different picture passes; discard removes an unpublished upload", async () => {
    const f = await stage(ben, await pngOf(1200, 2000));
    const res = await prepare(ben, f);
    expect(res.status).toBe(200);
    expect(res.body.similarTo).toBeNull();
    expect((await api("POST", "/api/wallpapers/upload/discard", { token: ben.token, json: { key: f.key } })).body).toEqual({ discarded: true });
    expect((await fetch(`${f.fileUrl}?nocache=${Date.now()}`)).status).toBe(404);
    expectError(await api("POST", "/api/wallpapers/upload/discard", { token: ben.token, json: { key: `wallpapers/${ana.id}/x.png` } }), 400, "Invalid file key");
  });
}, 240_000);
