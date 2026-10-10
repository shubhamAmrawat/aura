import { beforeAll, describe, expect, it } from "vitest";
import { api } from "../setup/http";
import { sql } from "../setup/db";
import { createUser, makeCreator, type TestUser } from "../setup/auth";
import { pngOf } from "../setup/images";
import { expectError, expectKeys } from "../setup/assert";
import { useTestCleanup } from "../setup/lifecycle";

useTestCleanup();

let viewer: TestUser;
let creator: TestUser;
let categoryId: string;

beforeAll(async () => {
  viewer = await createUser("up-viewer");
  creator = await createUser("up-creator");
  await makeCreator(creator);
  const [cat] = await sql<{ id: string }[]>`SELECT id FROM categories ORDER BY sort_order LIMIT 1`;
  categoryId = cat!.id;
});

async function presign(user: TestUser, fileType = "image/png") {
  const res = await api("POST", "/api/wallpapers/upload-url", { token: user.token, json: { fileType } });
  expect(res.status).toBe(200);
  return res.body as { uploadUrl: string; fileUrl: string; key: string };
}

async function putToR2(uploadUrl: string, bytes: Buffer, type = "image/png") {
  const res = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": type }, body: new Uint8Array(bytes) });
  expect(res.status).toBe(200);
}

/** Safety net: if moderation ever approved a test upload, hide it immediately before failing. */
async function guardPending(res: { body: any }) {
  const id = res.body?.wallpaper?.id;
  if (id && res.body.moderationStatus !== "pending") {
    await sql`UPDATE wallpapers SET status = 'rejected' WHERE id = ${id}`;
  }
  expect(res.body.moderationStatus).toBe("pending");
}

describe("POST /api/wallpapers/upload-url", () => {
  it("requires auth and an allowed type", async () => {
    expectError(await api("POST", "/api/wallpapers/upload-url", { json: { fileType: "image/png" } }), 401, "Unauthorized");
    expectError(await api("POST", "/api/wallpapers/upload-url", { token: viewer.token, json: { fileType: "image/gif" } }), 400, "Only JPEG, PNG and WebP are allowed");
  });

  it("returns a presigned URL scoped to the user", async () => {
    const res = await api("POST", "/api/wallpapers/upload-url", { token: viewer.token, json: { fileType: "image/webp" } });
    expectKeys(res.body, ["uploadUrl", "fileUrl", "key"]);
    expect(res.body.key).toMatch(new RegExp(`^wallpapers/${viewer.id}/[0-9a-f-]{36}\\.webp$`));
    expect(res.body.fileUrl).toBe(`${process.env.R2_PUBLIC_URL}/${res.body.key}`);
  });
});

describe("POST /api/wallpapers/upload", () => {
  it("auth + creator + field validation", async () => {
    expectError(await api("POST", "/api/wallpapers/upload", { json: {} }), 401, "Unauthorized");
    expectError(await api("POST", "/api/wallpapers/upload", { token: viewer.token, json: {} }), 403, "Only creators can upload wallpapers");
    const t = creator.token;
    expectError(await api("POST", "/api/wallpapers/upload", { token: t, json: { title: " " } }), 400, "Title is required");
    expectError(await api("POST", "/api/wallpapers/upload", { token: t, json: { title: "x", fileUrl: "u" } }), 400, "File is required");
    expectError(await api("POST", "/api/wallpapers/upload", { token: t, json: { title: "x", fileUrl: "u", key: "k" } }), 400, "Category is required");
    expectError(
      await api("POST", "/api/wallpapers/upload", { token: t, json: { title: "x", fileUrl: "u", key: `wallpapers/${viewer.id}/a.png`, categoryId } }),
      400, "Invalid file key"
    );
  });

  it("rejects images smaller than 200×200 and deletes the object", async () => {
    const { uploadUrl, fileUrl, key } = await presign(creator);
    await putToR2(uploadUrl, await pngOf(150, 300));
    const res = await api("POST", "/api/wallpapers/upload", {
      token: creator.token,
      json: { title: "tiny", fileUrl, key, categoryId, width: 150, height: 300, fileSizeBytes: 100, fileType: "image/png" },
    });
    expectError(res, 400, "Image must be at least 200×200 pixels.");
    expect((await fetch(fileUrl)).status).toBe(404);
  });

  it("full pipeline: stored as PENDING with extracted metadata, hidden from feeds", async () => {
    const { uploadUrl, fileUrl, key } = await presign(creator);
    await putToR2(uploadUrl, await pngOf(300, 400));
    const res = await api("POST", "/api/wallpapers/upload", {
      token: creator.token,
      json: {
        title: "  Contract Upload  ", description: "  test  ", categoryId, tags: ["blue", "test"],
        fileUrl, key, width: 1, height: 1, fileSizeBytes: 1234, fileType: "image/png",
      },
    });
    await guardPending(res);
    expect(res.status).toBe(200);
    expectKeys(res.body, ["wallpaper", "moderationStatus", "message"]);
    expect(res.body.message).toBe("Wallpaper uploaded and under review");
    const w = res.body.wallpaper;
    expect(w).toMatchObject({
      title: "Contract Upload", description: "test", fileUrl, categoryId, uploaderId: creator.id,
      tags: ["blue", "test"], width: 300, height: 400, isMobile: true, format: "png", fileSizeBytes: 1234,
      status: "pending", isPremium: false, isFeatured: false, isAiGenerated: false,
      downloadCount: 0, likeCount: 0, viewCount: 0,
    });
    expect(w.dominantColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(w.palette[0]).toBe(w.dominantColor);
    expect(typeof w.blurhash).toBe("string");

    const [u] = await sql<{ n: number }[]>`SELECT total_uploads AS n FROM users WHERE id = ${creator.id}`;
    expect(u!.n).toBe(1);
    const feed = await api("GET", "/api/wallpapers?limit=20");
    expect(feed.body.data.some((x: any) => x.id === w.id)).toBe(false);
  });
});
