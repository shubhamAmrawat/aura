import { beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { api } from "../setup/http";
import { sql } from "../setup/db";
import { createUser, readOtp, type TestUser } from "../setup/auth";
import { createTestWallpaper } from "../setup/fixtures";
import { pngOf } from "../setup/images";
import { expectError, expectKeys, NONEXISTENT_UUID } from "../setup/assert";
import { useTestCleanup } from "../setup/lifecycle";

useTestCleanup();

const TYPE_ERR = "Only JPEG, PNG and WebP images are allowed.";
const R2 = () => process.env.R2_PUBLIC_URL!;

let user: TestUser;
let other: TestUser;

beforeAll(async () => {
  user = await createUser("prof");
  other = await createUser("prof-other");
});

function fileForm(field: string, bytes: Buffer, type: string, name = "f.png") {
  const fd = new FormData();
  fd.append(field, new Blob([new Uint8Array(bytes)], { type }), name);
  return fd;
}

describe("GET/PUT /api/profile", () => {
  it("requires auth", async () => {
    const res = await api("GET", "/api/profile");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Unauthorized" });
  });

  it("returns full profile", async () => {
    const res = await api("GET", "/api/profile", { token: user.token });
    expect(res.status).toBe(200);
    expectKeys(res.body.user, [
      "id", "email", "username", "displayName", "avatarUrl", "coverUrl", "bio", "contactNo", "isCreator",
      "isPro", "totalDownloads", "totalUploads", "usernameChangedAt", "createdAt",
    ]);
    expect(res.body.user.id).toBe(user.id);
  });

  it("updates displayName/bio/contactNo", async () => {
    const res = await api("PUT", "/api/profile", { token: user.token, json: { displayName: "New Name", bio: "hi", contactNo: "123" } });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Profile updated successfully");
    expectKeys(res.body.user, ["id", "email", "username", "displayName", "avatarUrl", "bio", "contactNo", "usernameChangedAt"]);
    expect(res.body.user).toMatchObject({ displayName: "New Name", bio: "hi", contactNo: "123", usernameChangedAt: null });
  });

  it("username: taken → 409, change once, then 2-week cooldown → 429", async () => {
    expectError(await api("PUT", "/api/profile", { token: user.token, json: { username: other.username } }), 409, "Username already taken.");
    const newName = `${user.username}_x`;
    const ok = await api("PUT", "/api/profile", { token: user.token, json: { username: newName } });
    expect(ok.status).toBe(200);
    expect(ok.body.user.username).toBe(newName);
    expect(ok.body.user.usernameChangedAt).not.toBeNull();
    const again = await api("PUT", "/api/profile", { token: user.token, json: { username: `${user.username}_y` } });
    expect(again.status).toBe(429);
    expect(again.body.error).toMatch(/^Username can only be changed once every 2 weeks\. Next change available on .+\.$/);
    // same username as current is not a change
    expect((await api("PUT", "/api/profile", { token: user.token, json: { username: newName } })).status).toBe(200);
  });
});

describe.each([
  { kind: "avatar", folder: "avatars", Kind: "Avatar" },
  { kind: "cover", folder: "covers", Kind: "Cover" },
])("$kind presigned flow", ({ kind, folder, Kind }) => {
  it("upload-url validates type and scopes key to the user", async () => {
    expectError(await api("POST", `/api/profile/${kind}/upload-url`, { token: user.token, json: { fileType: "image/gif" } }), 400, TYPE_ERR);
    const res = await api("POST", `/api/profile/${kind}/upload-url`, { token: user.token, json: { fileType: "image/png" } });
    expect(res.status).toBe(200);
    expectKeys(res.body, ["uploadUrl", "fileUrl", "key"]);
    expect(res.body.key).toMatch(new RegExp(`^${folder}/${user.id}/[0-9a-f-]{36}\\.png$`));
    expect(res.body.fileUrl).toBe(`${R2()}/${res.body.key}`);
    expect(res.body.uploadUrl).toContain("X-Amz-Signature");
  });

  it("confirm validates key + url, then saves", async () => {
    expectError(await api("PUT", `/api/profile/${kind}`, { token: user.token, json: {} }), 400, "fileUrl and key are required.");
    const badKey = `${folder}/${other.id}/x.png`;
    expectError(await api("PUT", `/api/profile/${kind}`, { token: user.token, json: { key: badKey, fileUrl: `${R2()}/${badKey}` } }), 400, `Invalid ${kind} key.`);
    const key = `${folder}/${user.id}/contract-test.png`;
    expectError(await api("PUT", `/api/profile/${kind}`, { token: user.token, json: { key, fileUrl: "https://evil.example.com/x.png" } }), 400, `Invalid ${kind} URL.`);
    const ok = await api("PUT", `/api/profile/${kind}`, { token: user.token, json: { key, fileUrl: `${R2()}/${key}` } });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ message: `${Kind} updated successfully`, [`${kind}Url`]: `${R2()}/${key}` });
    const col = kind === "avatar" ? "avatar_url" : "cover_url";
    const [row] = await sql`SELECT ${sql(col)} AS url FROM users WHERE id = ${user.id}`;
    expect(row!.url).toBe(`${R2()}/${key}`);
  });
});

describe.each([
  { kind: "avatar", folder: "avatars", Kind: "Avatar", maxMb: 5 },
  { kind: "cover", folder: "covers", Kind: "Cover", maxMb: 10 },
])("$kind direct upload", ({ kind, folder, Kind, maxMb }) => {
  it("validates presence, type, size", async () => {
    const empty = new FormData();
    empty.append("other", "x");
    expectError(await api("POST", `/api/profile/${kind}/direct`, { token: user.token, form: empty }), 400, `${Kind} file is required.`);
    const textAsField = new FormData();
    textAsField.append(kind, "not a file");
    expectError(await api("POST", `/api/profile/${kind}/direct`, { token: user.token, form: textAsField }), 400, `${Kind} file is required.`);
    expectError(await api("POST", `/api/profile/${kind}/direct`, { token: user.token, form: fileForm(kind, Buffer.from("hello"), "text/plain", "a.txt") }), 400, TYPE_ERR);
    const big = Buffer.alloc(maxMb * 1024 * 1024 + 1, 1);
    expectError(await api("POST", `/api/profile/${kind}/direct`, { token: user.token, form: fileForm(kind, big, "image/png") }), 400, `${Kind} must be smaller than ${maxMb}MB.`);
  });

  it("uploads to R2 under the user's prefix and saves URL", async () => {
    const res = await api("POST", `/api/profile/${kind}/direct`, { token: user.token, form: fileForm(kind, await pngOf(40, 40), "image/png") });
    expect(res.status).toBe(200);
    expectKeys(res.body, ["message", `${kind}Url`]);
    expect(res.body.message).toBe(`${Kind} updated successfully`);
    const url: string = res.body[`${kind}Url`];
    expect(url).toMatch(new RegExp(`^${R2().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/${folder}/${user.id}/[0-9a-f-]{36}\\.png$`));
    const fetched = await fetch(url);
    expect(fetched.status).toBe(200);
  });

  it("requires auth", async () => {
    expectError(await api("POST", `/api/profile/${kind}/direct`, { form: fileForm(kind, await pngOf(10, 10), "image/png") }), 401, "Unauthorized");
  });
});

describe("change password", () => {
  it("verify: wrong current password → 400; right → OTP sent", async () => {
    expectError(await api("POST", "/api/profile/change-password/verify", { token: user.token, json: { currentPassword: "nope-nope" } }), 400, "Current password is incorrect.");
    const res = await api("POST", "/api/profile/change-password/verify", { token: user.token, json: { currentPassword: user.password } });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "OTP sent to your email." });
  });

  it("confirm: validation, wrong OTP, success", async () => {
    expectError(await api("POST", "/api/profile/change-password/confirm", { token: user.token, json: {} }), 400, "OTP and new password are required.");
    expectError(await api("POST", "/api/profile/change-password/confirm", { token: user.token, json: { otp: "1", newPassword: "short" } }), 400, "Password must be at least 8 characters.");
    const code = await readOtp(user.email, "password_reset");
    const wrong = code === "000000" ? "111111" : "000000";
    expectError(await api("POST", "/api/profile/change-password/confirm", { token: user.token, json: { otp: wrong, newPassword: "NewPassword-123" } }), 400, "Incorrect OTP.");
    const ok = await api("POST", "/api/profile/change-password/confirm", { token: user.token, json: { otp: code, newPassword: "NewPassword-123" } });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ message: "Password changed successfully." });
    const [u] = await sql<{ h: string }[]>`SELECT password_hash AS h FROM users WHERE id = ${user.id}`;
    expect(await bcrypt.compare("NewPassword-123", u!.h)).toBe(true);
    expect((await sql`SELECT 1 FROM otps WHERE email = ${user.email} AND type = 'password_reset'`).length).toBe(0);
    user.password = "NewPassword-123";
  });

  it("confirm without a pending OTP → 400", async () => {
    expectError(await api("POST", "/api/profile/change-password/confirm", { token: user.token, json: { otp: "123456", newPassword: "NewPassword-123" } }), 400, "Invalid OTP. Please request a new one.");
  });
});

describe("uploads management", () => {
  let wpId: string;
  beforeAll(async () => {
    wpId = await createTestWallpaper(user, { tags: ["one", "two"] });
    await sql`UPDATE users SET total_uploads = 1 WHERE id = ${user.id}`;
  });

  it("GET /uploads lists own wallpapers (any status)", async () => {
    const res = await api("GET", "/api/profile/uploads", { token: user.token });
    expect(res.status).toBe(200);
    expectKeys(res.body, ["data", "hasMore"]);
    expect(res.body.hasMore).toBe(false);
    expect(res.body.data.map((w: any) => w.id)).toEqual([wpId]);
    expectKeys(res.body.data[0], [
      "id", "title", "description", "fileUrl", "blurhash", "dominantColor", "width", "height", "tags",
      "categoryId", "status", "likeCount", "downloadCount", "createdAt", "format", "isMobile",
    ]);
    expect((await api("GET", "/api/profile/uploads", { token: other.token })).body).toEqual({ data: [], hasMore: false });
  });

  it("PUT /uploads/:id validation + ownership + update", async () => {
    expectError(await api("PUT", `/api/profile/uploads/${wpId}`, { token: user.token, json: { title: " " } }), 400, "Title is required");
    expectError(await api("PUT", `/api/profile/uploads/${NONEXISTENT_UUID}`, { token: user.token, json: { title: "x" } }), 404, "Wallpaper not found");
    expectError(await api("PUT", `/api/profile/uploads/${wpId}`, { token: other.token, json: { title: "x" } }), 403, "Not authorized");
    const res = await api("PUT", `/api/profile/uploads/${wpId}`, {
      token: user.token, json: { title: "  Edited  ", description: "  ", tags: [" a ", "", "b"], categoryId: "" },
    });
    expect(res.status).toBe(200);
    expectKeys(res.body, ["data"]);
    expect(res.body.data).toMatchObject({ id: wpId, title: "Edited", description: null, tags: ["a", "b"], categoryId: null });
    expect(res.body.data).toHaveProperty("textEmbedding");
  });

  it("DELETE /uploads/:id ownership + removal + counter floor", async () => {
    expectError(await api("DELETE", `/api/profile/uploads/${NONEXISTENT_UUID}`, { token: user.token }), 404, "Wallpaper not found");
    expectError(await api("DELETE", `/api/profile/uploads/${wpId}`, { token: other.token }), 403, "Not authorized");
    // a like + collection item on it must be cleaned up too
    await api("POST", `/api/likes/${wpId}`, { token: other.token });
    const col = await api("POST", "/api/collections", { token: other.token, json: { title: "c" } });
    await api("POST", `/api/collections/${col.body.collection.id}/wallpapers`, { token: other.token, json: { wallpaperId: wpId } });
    const res = await api("DELETE", `/api/profile/uploads/${wpId}`, { token: user.token });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "Wallpaper deleted" });
    expect((await sql`SELECT 1 FROM wallpapers WHERE id = ${wpId}`).length).toBe(0);
    const [c] = await sql<{ cover: string | null }[]>`SELECT cover_wallpaper_id AS cover FROM collections WHERE id = ${col.body.collection.id}`;
    expect(c!.cover).toBeNull();
    const [u] = await sql<{ n: number }[]>`SELECT total_uploads AS n FROM users WHERE id = ${user.id}`;
    expect(u!.n).toBe(0);
  });
});

describe("DELETE /api/profile (account)", () => {
  it("wrong password → 400", async () => {
    expectError(await api("DELETE", "/api/profile", { token: user.token, json: { password: "wrong-password" } }), 400, "Incorrect password.");
  });

  it("deletes a fresh account", async () => {
    const fresh = await createUser("prof-delete");
    const res = await api("DELETE", "/api/profile", { token: fresh.token, json: { password: fresh.password } });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "Account deleted successfully." });
    expect((await sql`SELECT 1 FROM users WHERE id = ${fresh.id}`).length).toBe(0);
  });

  it("KNOWN BUG (Phase 9): account with a like fails with 500 (FK)", async () => {
    const liker = await createUser("prof-liker");
    const wp = await createTestWallpaper(liker);
    await api("POST", `/api/likes/${wp}`, { token: liker.token });
    const res = await api("DELETE", "/api/profile", { token: liker.token, json: { password: liker.password } });
    expect(res.status).toBe(500);
    expect((await sql`SELECT 1 FROM users WHERE id = ${liker.id}`).length).toBe(1);
  });
});
