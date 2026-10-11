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

const list = (status: "pending" | "rejected", token = admin.token) =>
  api("GET", `/api/admin/review?status=${status}&limit=100`, { token });
const approve = (id: string, token = admin.token) => api("POST", `/api/admin/review/${id}/approve`, { token });
const reject = (id: string, reason?: unknown, token = admin.token) =>
  api("POST", `/api/admin/review/${id}/reject`, { token, json: reason === undefined ? {} : { reason } });
const row = async (id: string) =>
  (await sql`SELECT status, reviewed_by, reviewed_at, rejected_at, review_note FROM wallpapers WHERE id = ${id}`)[0]!;
const audit = async (id: string) =>
  (await sql<{ action: string; admin_id: string }[]>`SELECT action, admin_id FROM admin_actions WHERE target_id = ${id} ORDER BY created_at`);

beforeAll(async () => {
  [creator, user, admin] = await Promise.all([createUser("rv-creator"), createUser("rv-user"), createUser("rv-admin")]);
  await makeAdmin(admin);
});

describe("guard + validation", () => {
  it("normal users get 403 on every review endpoint", async () => {
    const id = await createTestWallpaper(creator);
    expectError(await list("pending", user.token), 403, "Admin access required.");
    expectError(await approve(id, user.token), 403, "Admin access required.");
    expectError(await reject(id, "nope", user.token), 403, "Admin access required.");
    expectError(await api("POST", "/api/admin/review/bulk", { token: user.token, json: { ids: [id], action: "approve" } }), 403, "Admin access required.");
    expect((await row(id)).status).toBe("pending");
  });

  it("rejects bad input", async () => {
    expectError(await api("GET", "/api/admin/review?status=approved", { token: admin.token }), 400, "status must be pending or rejected");
    expect((await api("GET", "/api/admin/review?limit=0", { token: admin.token })).status).toBe(400);
    expectError(await approve("not-a-uuid"), 400, "Invalid wallpaper id");
    expectError(await approve(NONEXISTENT_UUID), 404, "Wallpaper not found");
    const id = await createTestWallpaper(creator);
    expectError(await reject(id), 400, "A reason is required (3–300 characters).");
    expectError(await reject(id, "  x "), 400, "A reason is required (3–300 characters).");
    expectError(await reject(id, "y".repeat(301)), 400, "A reason is required (3–300 characters).");
  });
});

describe("pending queue", () => {
  it("lists pending uploads oldest first with uploader, category and moderation reason", async () => {
    const older = await createTestWallpaper(creator, { createdAt: new Date(Date.now() - 3_600_000) });
    const newer = await createTestWallpaper(creator);
    await sql`UPDATE wallpapers SET moderation_reason = 'Flagged for manual review (nudity 0.51, violence 0.02)' WHERE id = ${older}`;

    const res = await list("pending");
    expect(res.status).toBe(200);
    expectKeys(res.body, ["data", "total", "hasMore"]);
    const ids = res.body.data.map((w: { id: string }) => w.id);
    expect(ids.indexOf(older)).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf(older)).toBeLessThan(ids.indexOf(newer));

    const item = res.body.data.find((w: { id: string }) => w.id === older);
    expectKeys(item, [
      "id", "title", "description", "fileUrl", "blurhash", "dominantColor", "width", "height", "fileSizeBytes",
      "format", "tags", "isMobile", "isAiGenerated", "status", "moderationReason", "reviewNote", "reviewedAt",
      "rejectedAt", "createdAt", "category", "uploader", "purgeAt",
    ]);
    expect(item.status).toBe("pending");
    expect(item.moderationReason).toContain("nudity 0.51");
    expectKeys(item.uploader, ["id", "username", "displayName", "avatarUrl"]);
    expect(item.uploader.id).toBe(creator.id);
    expectKeys(item.category, ["id", "name"]);
    expect(item.purgeAt).toBeNull();
  });
});

describe("approve / reject / restore", () => {
  it("approve: sets status + reviewer, logs it, leaves the queue; second approve → 409", async () => {
    const id = await createTestWallpaper(creator);
    const res = await approve(id);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id, status: "approved" });

    const r = await row(id);
    expect(r.status).toBe("approved");
    expect(r.reviewed_by).toBe(admin.id);
    expect(r.reviewed_at).not.toBeNull();
    expect(await audit(id)).toEqual([{ action: "wallpaper.approve", admin_id: admin.id }]);

    expect((await list("pending")).body.data.some((w: { id: string }) => w.id === id)).toBe(false);
    expectError(await approve(id), 409, "Already approved.");
  });

  it("reject: hidden with reason + purge date; restore brings it back", async () => {
    const id = await createTestWallpaper(creator);
    const res = await reject(id, "  Low quality image  ");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id, status: "rejected" });

    const r = await row(id);
    expect(r.status).toBe("rejected");
    expect(r.review_note).toBe("Low quality image");
    expect(r.rejected_at).not.toBeNull();
    expectError(await reject(id, "again please"), 409, "Already rejected.");

    const rejected = (await list("rejected")).body.data.find((w: { id: string }) => w.id === id);
    expect(rejected.reviewNote).toBe("Low quality image");
    const days = (new Date(rejected.purgeAt).getTime() - new Date(rejected.rejectedAt).getTime()) / 86_400_000;
    expect(days).toBe(30);

    // restore = approve a rejected wallpaper
    expect((await approve(id)).body).toEqual({ id, status: "approved" });
    const restored = await row(id);
    expect(restored).toMatchObject({ status: "approved", rejected_at: null, review_note: null });
    expect((await audit(id)).map((a) => a.action)).toEqual(["wallpaper.reject", "wallpaper.restore"]);
  });

  it("approving an upload without a search embedding creates one", async () => {
    const id = await createTestWallpaper(creator, { noEmbedding: true });
    expect((await approve(id)).status).toBe(200);
    let has = false;
    for (let i = 0; i < 20 && !has; i++) {
      await new Promise((r) => setTimeout(r, 500));
      has = (await sql`SELECT text_embedding IS NOT NULL AS has FROM wallpapers WHERE id = ${id}`)[0]!.has;
    }
    expect(has).toBe(true);
  });
});

describe("bulk", () => {
  it("validates, then reports per-item results", async () => {
    const [a, b] = await Promise.all([createTestWallpaper(creator), createTestWallpaper(creator)]);
    const bulk = (json: unknown) => api("POST", "/api/admin/review/bulk", { token: admin.token, json });

    expectError(await bulk({ ids: [], action: "approve" }), 400, "Select at least one wallpaper.");
    expectError(await bulk({ ids: [a], action: "delete" }), 400, "action must be approve or reject");
    expectError(await bulk({ ids: [a], action: "reject" }), 400, "A reason is required (3–300 characters).");
    expectError(await bulk({ ids: Array(101).fill(a), action: "approve" }), 400, "At most 100 wallpapers at a time.");

    const res = await bulk({ ids: [a, b, a, NONEXISTENT_UUID], action: "reject", reason: "Duplicate content" });
    expect(res.status).toBe(200);
    expect(res.body.succeeded).toBe(2);
    expect(res.body.failed).toBe(1);
    expect(res.body.results).toContainEqual({ id: NONEXISTENT_UUID, ok: false, error: "Wallpaper not found" });
    expect((await row(a)).status).toBe("rejected");
    expect((await row(b)).review_note).toBe("Duplicate content");

    const again = await bulk({ ids: [a, b], action: "approve" });
    expect(again.body).toMatchObject({ action: "approve", succeeded: 2, failed: 0 });
  });
});

describe("overview counts", () => {
  it("user totals exclude admin accounts", async () => {
    const res = await api("GET", "/api/admin/stats/overview", { token: admin.token });
    const [db] = await sql<{ users: number; admins: number }[]>`
      SELECT count(*) FILTER (WHERE role = 'user')::int AS users, count(*) FILTER (WHERE role = 'admin')::int AS admins FROM users`;
    expect(res.body.users.total).toBe(db!.users);
    expect(res.body.users.admins).toBe(db!.admins);
  });
});
