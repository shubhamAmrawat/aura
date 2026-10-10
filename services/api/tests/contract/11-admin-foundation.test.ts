import { beforeAll, describe, expect, it } from "vitest";
import { api } from "../setup/http";
import { sql } from "../setup/db";
import { createUser, makeAdmin, makeCreator, type TestUser } from "../setup/auth";
import { createTestWallpaper } from "../setup/fixtures";
import { expectError, expectKeys } from "../setup/assert";
import { useTestCleanup } from "../setup/lifecycle";

useTestCleanup();

let user: TestUser;
let admin: TestUser;

beforeAll(async () => {
  [user, admin] = await Promise.all([createUser("adm-user"), createUser("adm-admin")]);
  await makeAdmin(admin);
});

describe("admin guard (/api/admin/*)", () => {
  it("anonymous → 401, normal user → 403, admin → 200", async () => {
    expectError(await api("GET", "/api/admin/stats/overview"), 401, "Unauthorized");
    expectError(await api("GET", "/api/admin/stats/overview", { token: user.token }), 403, "Admin access required.");
    expect((await api("GET", "/api/admin/stats/overview", { token: admin.token })).status).toBe(200);
  });

  it("works with the auth cookie too", async () => {
    const res = await api("GET", "/api/admin/stats/overview", { headers: { cookie: admin.cookie } });
    expect(res.status).toBe(200);
  });

  it("role is read from the DB on every request (demotion is immediate)", async () => {
    const temp = await createUser("adm-temp");
    await makeAdmin(temp);
    expect((await api("GET", "/api/admin/stats/overview", { token: temp.token })).status).toBe(200);
    await sql`UPDATE users SET role = 'user' WHERE id = ${temp.id}`;
    expectError(await api("GET", "/api/admin/stats/overview", { token: temp.token }), 403, "Admin access required.");
  });

  it("unknown admin routes are still guarded (403 for users, 404 for admins)", async () => {
    expectError(await api("GET", "/api/admin/nope", { token: user.token }), 403, "Admin access required.");
    expect((await api("GET", "/api/admin/nope", { token: admin.token })).status).toBe(404);
  });
});

describe("GET /api/admin/stats/overview", () => {
  it("returns the overview shape with numbers", async () => {
    const res = await api("GET", "/api/admin/stats/overview", { token: admin.token });
    expectKeys(res.body, ["users", "wallpapers", "downloads", "views", "likes", "generatedAt"]);
    expectKeys(res.body.users, ["total", "new7d", "new30d", "creators", "admins"]);
    expectKeys(res.body.wallpapers, ["total", "approved", "pending", "rejected", "featured", "new7d", "new30d", "storageBytes"]);
    expectKeys(res.body.downloads, ["total", "logged", "last7d", "last30d"]);
    expectKeys(res.body.views, ["total"]);
    expectKeys(res.body.likes, ["total", "last7d", "last30d"]);
    for (const group of ["users", "wallpapers", "downloads", "views", "likes"]) {
      for (const v of Object.values(res.body[group])) expect(typeof v).toBe("number");
    }
    expect(res.body.users.admins).toBeGreaterThanOrEqual(1);
  });

  it("counts a new pending upload", async () => {
    const before = (await api("GET", "/api/admin/stats/overview", { token: admin.token })).body.wallpapers;
    await makeCreator(user);
    await createTestWallpaper(user, { status: "pending" });
    const after = (await api("GET", "/api/admin/stats/overview", { token: admin.token })).body.wallpapers;
    expect(after.pending).toBe(before.pending + 1);
    expect(after.total).toBe(before.total + 1);
  });
});

describe("role in /me and /profile", () => {
  it("normal users get role 'user', admins get 'admin'", async () => {
    expect((await api("GET", "/api/auth/me", { token: user.token })).body.user.role).toBe("user");
    expect((await api("GET", "/api/auth/me", { token: admin.token })).body.user.role).toBe("admin");
    expect((await api("GET", "/api/profile", { token: admin.token })).body.user.role).toBe("admin");
  });
});

describe("review fields stay private", () => {
  it("GET /api/wallpapers/:id never exposes moderation/review columns", async () => {
    const wpId = await createTestWallpaper(admin, { status: "approved" });
    await sql`UPDATE wallpapers SET moderation_reason = 'x', reviewed_by = ${admin.id}, reviewed_at = now() WHERE id = ${wpId}`;
    const res = await api("GET", `/api/wallpapers/${wpId}`);
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    for (const k of ["moderationReason", "reviewedBy", "reviewedAt", "rejectedAt"]) expect(body).not.toContain(k);
  });
});

describe("role claim in the session token", () => {
  const claims = (token: string) => JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString());
  const passwordLogin = (u: TestUser) =>
    api("POST", "/api/auth/login/password", { json: { email: u.email, password: u.password } });

  it("normal logins carry role 'user'", async () => {
    const res = await passwordLogin(user);
    expect(res.status).toBe(200);
    expect(claims(res.body.token).role).toBe("user");
    expect(res.body.user.role).toBe("user");
  });

  it("admin logins carry role 'admin'", async () => {
    const res = await passwordLogin(admin);
    expect(res.status).toBe(200);
    expect(claims(res.body.token).role).toBe("admin");
    expect(res.body.user.role).toBe("admin");
  });

  it("signup tokens carry role 'user'", async () => {
    const fresh = await createUser("adm-fresh");
    expect(claims(fresh.token).role).toBe("user");
  });
});
