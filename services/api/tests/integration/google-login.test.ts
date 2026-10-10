import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import type { GoogleProfile } from "../../src/integrations/google";
import { sql } from "../setup/db";
import { cleanupTestData } from "../setup/cleanup";
import { RUN_EMAIL_PATTERN, RUN_ID, testEmail } from "../setup/run";

// Fake Google: the "credential" is a key into this table.
const profiles = new Map<string, GoogleProfile>();
vi.mock("../../src/integrations/google", () => ({
  googleAudiences: () => ["test-client-id"],
  verifyGoogleIdToken: async (token: string) => {
    const p = profiles.get(token);
    if (!p) throw new Error("invalid token");
    return p;
  },
}));

// Fake avatar copy: no network / R2. Pictures containing "fail" can't be copied.
const R2_TEST = "https://r2.test";
vi.mock("../../src/integrations/avatarImport", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../src/integrations/avatarImport")>();
  return {
    ...real,
    importGoogleAvatar: async (url: string, userId: string) =>
      url.includes("fail") ? null : `${R2_TEST}/avatars/${userId}.jpg`,
  };
});

const { createApp } = await import("../../src/app");
const app = createApp();
const google = (credential: string) => request(app).post("/api/auth/google").send({ credential });

function profile(key: string, overrides: Partial<GoogleProfile> = {}): GoogleProfile {
  const p: GoogleProfile = {
    sub: `sub-${RUN_ID}-${key}`,
    email: testEmail(key),
    emailVerified: true,
    name: `Google ${key}`,
    picture: "https://lh3.googleusercontent.com/test.png",
    ...overrides,
  };
  profiles.set(key, p);
  return p;
}

async function insertPasswordUser(key: string, extra: { googleId?: string; username?: string } = {}) {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO users (email, username, display_name, password_hash, is_email_verified, google_id)
    VALUES (${testEmail(key)}, ${extra.username ?? `t_${RUN_ID}_${key}`}, ${"Pw " + key},
            ${await bcrypt.hash("Test-password-123", 4)}, false, ${extra.googleId ?? null})
    RETURNING id`;
  return row!.id;
}

afterAll(async () => {
  await cleanupTestData(RUN_EMAIL_PATTERN);
  await sql.end();
});

describe("POST /api/auth/google (mocked verifier)", () => {
  it("creates a new passwordless, verified account and sets the cookie", async () => {
    const p = profile("g-new");
    const res = await google("g-new");
    expect(res.status).toBe(200);
    expect(res.body.isNewUser).toBe(true);
    expect(res.body.message).toBe("Logged in successfully");
    expect(res.body.user).toMatchObject({ email: p.email, displayName: "Google g-new", avatarUrl: `${R2_TEST}/avatars/${res.body.user.id}.jpg` });
    expect(res.headers["set-cookie"]?.[0]).toBe(`aura_token=${res.body.token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax`);

    const [row] = await sql`SELECT google_id, password_hash, is_email_verified, username FROM users WHERE id = ${res.body.user.id}`;
    expect(row).toMatchObject({ google_id: p.sub, password_hash: null, is_email_verified: true });
    expect(row!.username).toMatch(/^[a-z0-9_]{3,20}$/);

    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${res.body.token}`);
    expect(me.body.user).toMatchObject({ hasPassword: false, googleLinked: true });
  });

  it("the same Google account logs into the same user", async () => {
    const first = await google("g-new");
    expect(first.body.isNewUser).toBe(false);
    const again = await google("g-new");
    expect(again.body.user.id).toBe(first.body.user.id);
  });

  it("links Google to an existing email/password account (email match is case-insensitive)", async () => {
    const id = await insertPasswordUser("g-link");
    profile("g-link", { email: testEmail("g-link").toUpperCase() });
    const res = await google("g-link");
    expect(res.status).toBe(200);
    expect(res.body.isNewUser).toBe(false);
    expect(res.body.user.id).toBe(id);
    const [row] = await sql`SELECT google_id, password_hash IS NOT NULL AS has_pw, is_email_verified, avatar_url FROM users WHERE id = ${id}`;
    expect(row).toMatchObject({ google_id: `sub-${RUN_ID}-g-link`, has_pw: true, is_email_verified: true, avatar_url: `${R2_TEST}/avatars/${id}.jpg` });
  });

  it("keeps Google's link if copying the photo fails, and copies it on a later login", async () => {
    profile("g-avfail", { picture: "https://lh3.googleusercontent.com/fail.png" });
    const first = await google("g-avfail");
    expect(first.status).toBe(200);
    expect(first.body.user.avatarUrl).toBe("https://lh3.googleusercontent.com/fail.png");

    profile("g-avfail", { picture: "https://lh3.googleusercontent.com/ok.png" });
    await sql`UPDATE users SET avatar_url = 'https://lh3.googleusercontent.com/ok.png' WHERE id = ${first.body.user.id}`;
    const second = await google("g-avfail");
    expect(second.body.user.avatarUrl).toBe(`${R2_TEST}/avatars/${first.body.user.id}.jpg`);
  });

  it("never replaces a non-Google avatar", async () => {
    const id = await insertPasswordUser("g-own");
    await sql`UPDATE users SET avatar_url = 'https://cdn.example/own.png' WHERE id = ${id}`;
    profile("g-own");
    const res = await google("g-own");
    expect(res.body.user.avatarUrl).toBe("https://cdn.example/own.png");
  });

  it("refuses to link an email already linked to another Google account", async () => {
    await insertPasswordUser("g-conflict", { googleId: `sub-${RUN_ID}-someone-else` });
    profile("g-conflict");
    const res = await google("g-conflict");
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "This email is already linked to a different Google account." });
  });

  it("rejects unverified Google emails and invalid tokens", async () => {
    profile("g-unverified", { emailVerified: false });
    expect((await google("g-unverified")).body).toEqual({ error: "Your Google email address isn't verified." });
    const bad = await google("no-such-token");
    expect(bad.status).toBe(401);
    expect(bad.body).toEqual({ error: "Google sign-in failed." });
  });

  it("picks a free username when the email-derived one is taken", async () => {
    const p = profile("g-collide");
    const base = p.email.split("@")[0]!.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
    // Make sure the base username is taken (an earlier test's user may already hold it).
    const taken = await sql`SELECT 1 FROM users WHERE username = ${base}`;
    if (taken.length === 0) await insertPasswordUser("g-collide-holder", { username: base });
    const res = await google("g-collide");
    expect(res.status).toBe(200);
    const [row] = await sql<{ username: string }[]>`SELECT username FROM users WHERE id = ${res.body.user.id}`;
    expect(row!.username).not.toBe(base);
    expect(row!.username).toMatch(new RegExp(`^${base.slice(0, 15)}_\\d{4}$`));
  });
});
