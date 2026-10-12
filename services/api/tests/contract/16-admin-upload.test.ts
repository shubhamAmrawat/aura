import { beforeAll, describe, expect, it } from "vitest";
import { api } from "../setup/http";
import { sql } from "../setup/db";
import { createUser, makeAdmin, type TestUser } from "../setup/auth";
import { pngOf } from "../setup/images";
import { expectError, NONEXISTENT_UUID } from "../setup/assert";
import { useTestCleanup } from "../setup/lifecycle";

useTestCleanup();

let viewer: TestUser;
let admin: TestUser;
let otherAdmin: TestUser;
let categoryId: string;

beforeAll(async () => {
  viewer = await createUser("upl-viewer");
  admin = await createUser("upl-admin");
  otherAdmin = await createUser("upl-admin2");
  await makeAdmin(admin);
  await makeAdmin(otherAdmin);
  const [cat] = await sql<{ id: string }[]>`SELECT id FROM categories ORDER BY sort_order LIMIT 1`;
  categoryId = cat!.id;
});

type Presigned = { uploadUrl: string; fileUrl: string; key: string };

async function presign(user: TestUser, files: { fileType: string; fileSizeBytes: number }[]) {
  const res = await api("POST", "/api/admin/uploads/urls", { token: user.token, json: { files } });
  expect(res.status).toBe(200);
  return res.body.items as Presigned[];
}

async function put(url: string, bytes: Buffer, type = "image/png") {
  return fetch(url, { method: "PUT", headers: { "Content-Type": type }, body: new Uint8Array(bytes) });
}

/** Presign + PUT one PNG, returning what the create call needs. */
async function stage(user: TestUser, bytes: Buffer) {
  const [p] = await presign(user, [{ fileType: "image/png", fileSizeBytes: bytes.length }]);
  expect((await put(p!.uploadUrl, bytes)).status).toBe(200);
  return { key: p!.key, fileUrl: p!.fileUrl, fileType: "image/png", fileSizeBytes: bytes.length };
}

describe("admin upload — access", () => {
  it("both endpoints need an admin", async () => {
    for (const path of ["/api/admin/uploads/urls", "/api/admin/uploads"]) {
      expectError(await api("POST", path, { json: {} }), 401, "Unauthorized");
      expectError(await api("POST", path, { token: viewer.token, json: {} }), 403, "Admin access required.");
    }
  });
});

describe("POST /api/admin/uploads/urls", () => {
  it("validates the batch", async () => {
    const t = admin.token;
    const call = (files: unknown) => api("POST", "/api/admin/uploads/urls", { token: t, json: { files } });
    expectError(await call([]), 400, "Send 1 to 50 files at a time.");
    expectError(await call(Array.from({ length: 51 }, () => ({ fileType: "image/png", fileSizeBytes: 10 }))), 400, "Send 1 to 50 files at a time.");
    expectError(await call([{ fileType: "image/gif", fileSizeBytes: 10 }]), 400, "Only JPEG, PNG and WebP images are allowed.");
    expectError(await call([{ fileType: "image/png", fileSizeBytes: 25 * 1024 * 1024 + 1 }]), 400, "Each file must be 25 MB or smaller.");
    expectError(await call([{ fileType: "image/png", fileSizeBytes: 0 }]), 400, "The file is empty.");
  });

  it("returns one URL per file, in order, inside the admin's folder", async () => {
    const items = await presign(admin, [
      { fileType: "image/jpeg", fileSizeBytes: 100 },
      { fileType: "image/webp", fileSizeBytes: 200 },
    ]);
    expect(items).toHaveLength(2);
    expect(items[0]!.key).toMatch(new RegExp(`^wallpapers/admin/${admin.id}/[0-9a-f-]{36}\\.jpeg$`));
    expect(items[1]!.key).toMatch(new RegExp(`^wallpapers/admin/${admin.id}/[0-9a-f-]{36}\\.webp$`));
    expect(items[0]!.fileUrl).toBe(`${process.env.R2_PUBLIC_URL}/${items[0]!.key}`);
  });

  it("each URL only accepts a file of the declared size", async () => {
    const bytes = await pngOf(300, 300);
    const [p] = await presign(admin, [{ fileType: "image/png", fileSizeBytes: bytes.length + 500 }]);
    const wrong = await put(p!.uploadUrl, bytes);
    expect(wrong.status).toBe(403);
    const [ok] = await presign(admin, [{ fileType: "image/png", fileSizeBytes: bytes.length }]);
    expect((await put(ok!.uploadUrl, bytes)).status).toBe(200);
  });
});

describe("POST /api/admin/uploads", () => {
  it("validates input and ownership of the file", async () => {
    const t = admin.token;
    const base = {
      key: `wallpapers/admin/${admin.id}/00000000-0000-4000-8000-000000000000.png`,
      fileUrl: `${process.env.R2_PUBLIC_URL}/wallpapers/admin/${admin.id}/00000000-0000-4000-8000-000000000000.png`,
      fileType: "image/png", fileSizeBytes: 100, title: "x", categoryId,
    };
    const call = (patch: Record<string, unknown>) => api("POST", "/api/admin/uploads", { token: t, json: { ...base, ...patch } });
    expectError(await call({ title: "  " }), 400, "Title is required");
    expectError(await call({ categoryId: "nope" }), 400, "Category is required");
    expectError(await call({ fileSizeBytes: 26 * 1024 * 1024 }), 400, "Each file must be 25 MB or smaller.");
    // someone else's folder, a creator folder, a wrong extension
    const other = `wallpapers/admin/${otherAdmin.id}/00000000-0000-4000-8000-000000000000.png`;
    expectError(await call({ key: other, fileUrl: `${process.env.R2_PUBLIC_URL}/${other}` }), 400, "Invalid file key");
    expectError(await call({ key: `wallpapers/${admin.id}/a.png` }), 400, "Invalid file key");
    expectError(await call({ fileType: "image/jpeg" }), 400, "Invalid file key");
    expectError(await call({ fileUrl: "https://evil.example.com/x.png" }), 400, "fileUrl does not match the key");
    expectError(await call({ categoryId: NONEXISTENT_UUID }), 400, "Category not found");
  });

  it("refuses images under 200×200 and deletes the object", async () => {
    const f = await stage(admin, await pngOf(150, 400));
    expectError(await api("POST", "/api/admin/uploads", { token: admin.token, json: { ...f, title: "tiny", categoryId } }), 400, "Image must be at least 200×200 pixels.");
    expect((await fetch(`${f.fileUrl}?nocache=${Date.now()}`)).status).toBe(404);
  });

  it("hold for review: stored as PENDING, no uploader, full metadata, audited", async () => {
    const f = await stage(admin, await pngOf(320, 480));
    const res = await api("POST", "/api/admin/uploads", {
      token: admin.token,
      json: { ...f, width: 1, height: 1, title: "  Admin Upload  ", description: " d ", tags: ["Blue", "blue", "test"], categoryId, isPremium: true, isAiGenerated: true, publish: false },
    });
    expect(res.status).toBe(201);
    expect(Object.keys(res.body).sort()).toEqual(["category", "moderation", "wallpaper", "warnings"]);
    expect(res.body.category).toEqual({ id: categoryId, name: expect.any(String), auto: false });
    expect(res.body.wallpaper).toMatchObject({ title: "Admin Upload", fileUrl: f.fileUrl, status: "pending", width: 320, height: 480, isMobile: true, format: "png" });
    expect(Array.isArray(res.body.warnings)).toBe(true);

    const [row] = await sql`SELECT * FROM wallpapers WHERE id = ${res.body.wallpaper.id}`;
    expect(row).toMatchObject({
      uploader_id: null, description: "d", tags: ["Blue", "test"], category_id: categoryId, is_premium: true,
      is_ai_generated: true, is_featured: false, file_size_bytes: f.fileSizeBytes, reviewed_by: null,
    });
    expect(row!.dominant_color).toMatch(/^#[0-9a-f]{6}$/);
    const [audit] = await sql`SELECT action, details FROM admin_actions WHERE target_id = ${row!.id}`;
    expect(audit).toMatchObject({ action: "wallpaper.upload", details: { title: "Admin Upload", published: false } });

    const feed = await api("GET", "/api/wallpapers?limit=20");
    expect(feed.body.data.some((x: any) => x.id === row!.id)).toBe(false);

    // the same bytes again → flagged as a likely duplicate
    const again = await stage(admin, await pngOf(320, 480));
    const dup = await api("POST", "/api/admin/uploads", { token: admin.token, json: { ...again, title: "Admin Upload 2", categoryId, publish: false } });
    expect(dup.status).toBe(201);
    expect(dup.body.warnings.some((w: string) => w.startsWith("Possible duplicate of"))).toBe(true);
  });

  it("categoryId \"auto\": the AI files it (here a plain blue image) into some real category", async () => {
    const f = await stage(admin, await pngOf(500, 900));
    const res = await api("POST", "/api/admin/uploads", { token: admin.token, json: { ...f, title: "Calm blue gradient", tags: ["blue", "gradient"], categoryId: "auto", publish: false } });
    expect(res.status).toBe(201);
    expect(res.body.category.auto).toBe(true);
    const [row] = await sql`SELECT w.category_id, c.name FROM wallpapers w JOIN categories c ON c.id = w.category_id WHERE w.id = ${res.body.wallpaper.id}`;
    expect(row!.category_id).toBe(res.body.category.id);
    expect(row!.name).toBe(res.body.category.name);
  });

  it("publish: approved with the admin as reviewer", async () => {
    const f = await stage(admin, await pngOf(640, 360));
    const res = await api("POST", "/api/admin/uploads", { token: admin.token, json: { ...f, title: "aura-test publish", categoryId } });
    // hide it again straight away — this is the production database
    if (res.body?.wallpaper?.id) await sql`UPDATE wallpapers SET status = 'rejected' WHERE id = ${res.body.wallpaper.id}`;
    expect(res.status).toBe(201);
    expect(res.body.wallpaper).toMatchObject({ status: "approved", isMobile: false });
    const [row] = await sql`SELECT reviewed_by, reviewed_at FROM wallpapers WHERE id = ${res.body.wallpaper.id}`;
    expect(row!.reviewed_by).toBe(admin.id);
    expect(row!.reviewed_at).not.toBeNull();
  });
});
