import { beforeAll, describe, expect, it } from "vitest";
import { api } from "../setup/http";
import { sql } from "../setup/db";
import { createUser, makeAdmin, makeCreator, type TestUser } from "../setup/auth";
import { createTestWallpaper } from "../setup/fixtures";
import { expectError, NONEXISTENT_UUID } from "../setup/assert";
import { useTestCleanup } from "../setup/lifecycle";

useTestCleanup();

let admin: TestUser;
let otherAdmin: TestUser;
let alice: TestUser; // plain user with activity
let bob: TestUser; // creator, locked

const LIST_KEYS = [
  "avatarUrl", "createdAt", "disabled", "disabledAt", "disabledReason", "displayName", "downloads", "email", "failedLoginAttempts", "hasGoogle", "hasPassword", "id",
  "isCreator", "isEmailVerified", "lastActiveAt", "likes", "locked", "lockedUntil", "role", "uploads", "username",
];

beforeAll(async () => {
  [admin, otherAdmin, alice, bob] = await Promise.all([createUser("usr-admin"), createUser("usr-admin2"), createUser("usr-alice"), createUser("usr-bob")]);
  await makeAdmin(admin);
  await makeAdmin(otherAdmin);
  await makeCreator(bob);
  await sql`UPDATE users SET failed_login_attempts = 5, locked_until = now() + interval '15 minutes' WHERE id = ${bob.id}`;
  // alice: 2 uploads (pending, never public), 1 download, 1 like on her own upload
  const w1 = await createTestWallpaper(alice);
  await createTestWallpaper(alice);
  await sql`INSERT INTO downloads (user_id, wallpaper_id, quality, source) VALUES (${alice.id}, ${w1}, 'original', 'web')`;
  await sql`INSERT INTO likes (user_id, wallpaper_id) VALUES (${alice.id}, ${w1})`;
});

const call = (method: string, path: string, json?: unknown, token = admin.token) => api(method, `/api/admin/users${path}`, { token, json });

describe("admin users — access", () => {
  it("needs an admin", async () => {
    expectError(await api("GET", "/api/admin/users"), 401, "Unauthorized");
    expectError(await call("GET", "", undefined, alice.token), 403, "Admin access required.");
    expectError(await call("DELETE", `/${bob.id}`, { confirmEmail: bob.email }, alice.token), 403, "Admin access required.");
  });
});

describe("GET /api/admin/users", () => {
  it("search, live counts and shape", async () => {
    const res = await call("GET", `?q=${encodeURIComponent(alice.email)}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    const a = res.body.data[0];
    expect(Object.keys(a).sort()).toEqual(LIST_KEYS);
    expect(a).toMatchObject({ id: alice.id, role: "user", isCreator: false, hasPassword: true, hasGoogle: false, locked: false, uploads: 2, downloads: 1, likes: 1 });
    expect(a.lastActiveAt).not.toBeNull();
    // username and display name match too
    expect((await call("GET", `?q=${alice.username}`)).body.data.map((u: any) => u.id)).toEqual([alice.id]);
  });

  it("filters + sort + validation", async () => {
    const ids = (r: any) => r.body.data.map((u: any) => u.id);
    const run = RUN(alice.email);
    expect(ids(await call("GET", `?q=${run}&creator=true`))).toEqual([bob.id]);
    expect(ids(await call("GET", `?q=${run}&locked=true`))).toEqual([bob.id]);
    expect(ids(await call("GET", `?q=${run}&role=admin`)).sort()).toEqual([admin.id, otherAdmin.id].sort());
    expect(ids(await call("GET", `?q=${run}&signIn=google-only`))).toEqual([]);
    expect(ids(await call("GET", `?q=${run}&sort=uploads`))[0]).toBe(alice.id);
    const bobRow = (await call("GET", `?q=${encodeURIComponent(bob.email)}`)).body.data[0];
    expect(bobRow).toMatchObject({ isCreator: true, locked: true, failedLoginAttempts: 5 });
    expectError(await call("GET", "?sort=nope"), 400, "Invalid sort");
    expectError(await call("GET", "?signIn=nope"), 400, "Invalid sign-in filter");
    expectError(await call("GET", "?locked=maybe"), 400, "locked must be true or false");
  });
});

/** "aura-test+<run>-" — matches every user created by this test run */
function RUN(email: string) { return encodeURIComponent(email.slice(0, email.lastIndexOf("-") + 1)); }

describe("GET /api/admin/users/:id", () => {
  it("full detail with activity", async () => {
    expectError(await call("GET", `/${NONEXISTENT_UUID}`), 404, "User not found");
    expectError(await call("GET", "/nope"), 400, "User not found");
    const res = await call("GET", `/${alice.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: alice.id, collections: 0, uploads: 2 });
    expect(res.body.recentUploads).toHaveLength(2);
    expect(res.body.recentDownloads[0]).toMatchObject({ quality: "original", source: "web" });
    expect(res.body.recentLikes).toHaveLength(1);
    expect(res.body.history).toEqual([]);
  });
});

describe("actions", () => {
  it("creator on/off, audited; admins and yourself are off-limits", async () => {
    let res = await call("PATCH", `/${alice.id}`, { isCreator: true });
    expect(res.body.isCreator).toBe(true);
    res = await call("PATCH", `/${alice.id}`, { isCreator: false });
    expect(res.body.isCreator).toBe(false);
    expect(res.body.history.map((h: any) => h.action)).toEqual(["user.creator.revoke", "user.creator.grant"]);
    expect(res.body.history[0].adminEmail).toBe(admin.email);

    expectError(await call("PATCH", `/${alice.id}`, { isCreator: "yes" }), 400, "isCreator must be true or false");
    expectError(await call("PATCH", `/${alice.id}`, { isCreator: true, role: "admin" }), 400, 'Unrecognized key: "role"');
    expectError(await call("PATCH", `/${admin.id}`, { isCreator: true }), 403, "You can't change your own account here.");
    expectError(await call("PATCH", `/${otherAdmin.id}`, { isCreator: true }), 403, "Admin accounts can't be changed here.");
    expectError(await call("POST", `/${otherAdmin.id}/unlock`), 403, "Admin accounts can't be changed here.");
  });

  it("unlock clears the lockout", async () => {
    const res = await call("POST", `/${bob.id}/unlock`);
    expect(res.body).toMatchObject({ locked: false, failedLoginAttempts: 0, lockedUntil: null });
    expect(res.body.history[0]).toMatchObject({ action: "user.unlock", details: { wasLocked: true, failedAttempts: 5 } });
    // bob can sign in again
    const login = await api("POST", "/api/auth/login/password", { json: { email: bob.email, password: bob.password } });
    expect(login.status).toBe(200);
  });

  it("delete needs the typed email; removes the account and its uploads; audited", async () => {
    expectError(await call("DELETE", `/${alice.id}`, {}), 400, "Type the user's email to confirm.");
    expectError(await call("DELETE", `/${alice.id}`, { confirmEmail: "x@example.com" }), 400, "The email doesn't match. Type the user's email to confirm.");
    expectError(await call("DELETE", `/${otherAdmin.id}`, { confirmEmail: otherAdmin.email }), 403, "Admin accounts can't be changed here.");
    expectError(await call("DELETE", `/${admin.id}`, { confirmEmail: admin.email }), 403, "You can't change your own account here.");

    const res = await call("DELETE", `/${alice.id}`, { confirmEmail: alice.email.toUpperCase() });
    expect(res.body).toEqual({ id: alice.id, deleted: true, uploadsRemoved: 2 });
    expect((await sql`SELECT 1 FROM users WHERE id = ${alice.id}`).length).toBe(0);
    expect((await sql`SELECT 1 FROM wallpapers WHERE uploader_id = ${alice.id}`).length).toBe(0);
    expect((await sql`SELECT 1 FROM likes WHERE user_id = ${alice.id}`).length).toBe(0);
    const [a] = await sql`SELECT details FROM admin_actions WHERE action = 'user.delete' AND target_id = ${alice.id}`;
    expect(a!.details).toMatchObject({ email: alice.email, uploadsRemoved: 2 });
    expectError(await call("GET", `/${alice.id}`), 404, "User not found");
    // her old token no longer works
    expect((await api("GET", "/api/auth/me", { token: alice.token })).status).not.toBe(200);
  });
});

describe("disable / enable", () => {
  it("blocks sign-in and sessions, hides live uploads; enable restores everything", async () => {
    const dave = await createUser("usr-dave");
    const fan = await createUser("usr-fan");
    const live = await createTestWallpaper(dave);
    const pend = await createTestWallpaper(dave);
    await sql`INSERT INTO likes (user_id, wallpaper_id) VALUES (${fan.id}, ${live})`;
    const fanLikes = async () => ((await api("GET", "/api/likes", { token: fan.token })).body.data as any[]).map((w) => w.id);
    expect(await fanLikes()).toContain(live);

    expectError(await call("POST", `/${dave.id}/disable`, {}), 400, "A reason is required (3–300 characters).");
    expectError(await call("POST", `/${dave.id}/disable`, { reason: "x" }), 400, "A reason is required (3–300 characters).");
    expectError(await call("POST", `/${otherAdmin.id}/disable`, { reason: "spam spam" }), 403, "Admin accounts can't be changed here.");
    expectError(await call("POST", `/${admin.id}/disable`, { reason: "spam spam" }), 403, "You can't change your own account here.");
    expectError(await call("POST", `/${dave.id}/enable`), 409, "This account isn't disabled.");

    await sql`UPDATE wallpapers SET status = 'approved' WHERE id = ${live}`; // hidden again by the disable right below
    const res = await call("POST", `/${dave.id}/disable`, { reason: "Uploading stolen art" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ disabled: true, disabledReason: "Uploading stolen art", disabledByEmail: admin.email, hiddenUploads: 1, liveUploads: 0 });
    expectError(await call("POST", `/${dave.id}/disable`, { reason: "again again" }), 409, "This account is already disabled.");

    // wallpapers: the live one is hidden, the pending one untouched
    const st = await sql`SELECT id, status FROM wallpapers WHERE id IN (${live}, ${pend})`;
    expect(Object.fromEntries(st.map((r: any) => [r.id, r.status]))).toEqual({ [live]: "hidden", [pend]: "pending" });
    expectError(await api("GET", `/api/wallpapers/${live}`), 404, "Wallpaper not found");
    expect(await fanLikes()).not.toContain(live);
    expectError(await api("POST", `/api/admin/review/${live}/approve`, { token: admin.token }), 409,
      "This wallpaper is hidden because its uploader's account is disabled. Re-enable the account to show it again.");

    // no sign-in by any route; the existing session stops working
    const DISABLED = "This account has been disabled. Contact support.";
    expectError(await api("GET", "/api/auth/me", { token: dave.token }), 403, DISABLED);
    expectError(await api("POST", "/api/auth/login/password", { json: { email: dave.email, password: dave.password } }), 403, DISABLED);
    // wrong password still says the generic thing (doesn't reveal the account is disabled)
    expect((await api("POST", "/api/auth/login/password", { json: { email: dave.email, password: "Wrong-pass-123" } })).status).toBe(401);
    const forgot = await api("POST", "/api/auth/forgot-password", { json: { email: dave.email } });
    expect(forgot.status).toBe(200);
    expect((await sql`SELECT 1 FROM otps WHERE email = ${dave.email} AND type = 'password_reset'`).length).toBe(0);

    // list filter
    const ids = (await call("GET", `?q=${RUN(dave.email)}&status=disabled`)).body.data.map((u: any) => u.id);
    expect(ids).toEqual([dave.id]);

    // enable
    const en = await call("POST", `/${dave.id}/enable`);
    expect(en.body).toMatchObject({ disabled: false, disabledReason: null, hiddenUploads: 0, liveUploads: 1 });
    expect(en.body.history.slice(0, 2).map((h: any) => h.action)).toEqual(["user.enable", "user.disable"]);
    expect(en.body.history[1].details).toMatchObject({ reason: "Uploading stolen art", wallpapersHidden: 1 });
    expect((await api("GET", "/api/auth/me", { token: dave.token })).status).toBe(200);
    expect((await api("POST", "/api/auth/login/password", { json: { email: dave.email, password: dave.password } })).status).toBe(200);
    expect((await sql`SELECT status FROM wallpapers WHERE id = ${live}`)[0]!.status).toBe("approved");
    await sql`UPDATE wallpapers SET status = 'pending' WHERE id = ${live}`; // keep test data off the public site
  });
});
