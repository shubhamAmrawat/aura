import { describe, expect, it } from "vitest";
import { api } from "../setup/http";
import { sql } from "../setup/db";
import { createUser, readOtp } from "../setup/auth";
import { testEmail, testUsername } from "../setup/run";
import { expectError, expectKeys } from "../setup/assert";
import { useTestCleanup } from "../setup/lifecycle";

useTestCleanup();

const COOKIE_DEV = (token: string) =>
  `aura_token=${token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax`;

function decodeJwt(token: string) {
  return JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString());
}

describe("POST /api/auth/send-otp", () => {
  it("requires email and type", async () => {
    expectError(await api("POST", "/api/auth/send-otp", { json: {} }), 400, "Email and type are required");
    expectError(await api("POST", "/api/auth/send-otp", { json: { email: testEmail("x") } }), 400, "Email and type are required");
  });

  it("validates email format", async () => {
    expectError(await api("POST", "/api/auth/send-otp", { json: { email: "not-an-email", type: "signup" } }), 400, "Invalid email format");
  });

  it("login for unknown email → 404", async () => {
    expectError(await api("POST", "/api/auth/send-otp", { json: { email: testEmail("nobody"), type: "login" } }), 404, "No account found. Please signup.");
  });

  it("signup for existing email → 409", async () => {
    const u = await createUser("dup");
    expectError(await api("POST", "/api/auth/send-otp", { json: { email: u.email, type: "signup" } }), 409, "Email already registered. Please login.");
  });

  it("stores a single 6-digit OTP valid ~15 minutes, replacing previous ones", async () => {
    const email = testEmail("otp1");
    const first = await api("POST", "/api/auth/send-otp", { json: { email, type: "signup" } });
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ message: "OTP sent successfully" });
    await api("POST", "/api/auth/send-otp", { json: { email, type: "signup" } });

    const rows = await sql<{ code: string; attempts: number; verified: boolean; mins: number }[]>`
      SELECT code, attempts, verified, EXTRACT(EPOCH FROM (expires_at - created_at)) / 60 AS mins
      FROM otps WHERE email = ${email} AND type = 'signup'`;
    expect(rows.length).toBe(1);
    expect(rows[0]!.code).toMatch(/^\d{6}$/);
    expect(rows[0]!.attempts).toBe(0);
    expect(rows[0]!.verified).toBe(false);
    expect(Number(rows[0]!.mins)).toBeGreaterThan(14.9);
    expect(Number(rows[0]!.mins)).toBeLessThan(15.1);
  });
});

describe("POST /api/auth/verify-otp", () => {
  it("requires email, code and type", async () => {
    expectError(await api("POST", "/api/auth/verify-otp", { json: { email: testEmail("v") } }), 400, "Email, code and type are required");
  });

  it("no pending OTP → 400", async () => {
    expectError(
      await api("POST", "/api/auth/verify-otp", { json: { email: testEmail("none"), code: "123456", type: "signup" } }),
      400, "Invalid OTP. Please request a new one."
    );
  });

  it("wrong code counts down attempts then locks with 429", async () => {
    const email = testEmail("wrong");
    await api("POST", "/api/auth/send-otp", { json: { email, type: "signup" } });
    const real = await readOtp(email, "signup");
    const wrong = real === "000000" ? "111111" : "000000";
    const call = () => api("POST", "/api/auth/verify-otp", { json: { email, code: wrong, type: "signup" } });
    expectError(await call(), 400, "Incorrect OTP. 2 attempts remaining.");
    expectError(await call(), 400, "Incorrect OTP. 1 attempt remaining.");
    expectError(await call(), 400, "Incorrect OTP. 0 attempts remaining.");
    expectError(await call(), 429, "Too many attempts. Please request a new OTP.");
    // even the right code is now locked
    expectError(await api("POST", "/api/auth/verify-otp", { json: { email, code: real, type: "signup" } }), 429, "Too many attempts. Please request a new OTP.");
  });

  it("expired OTP → 400", async () => {
    const email = testEmail("expired");
    await api("POST", "/api/auth/send-otp", { json: { email, type: "signup" } });
    await sql`UPDATE otps SET expires_at = NOW() - INTERVAL '1 minute' WHERE email = ${email}`;
    const code = await readOtp(email, "signup");
    expectError(await api("POST", "/api/auth/verify-otp", { json: { email, code, type: "signup" } }), 400, "OTP expired. Please request a new one.");
  });

  it("correct code verifies", async () => {
    const email = testEmail("ok");
    await api("POST", "/api/auth/send-otp", { json: { email, type: "signup" } });
    const code = await readOtp(email, "signup");
    const res = await api("POST", "/api/auth/verify-otp", { json: { email, code, type: "signup" } });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "OTP verified successfully", verified: true });
    const [row] = await sql<{ verified: boolean }[]>`SELECT verified FROM otps WHERE email = ${email}`;
    expect(row!.verified).toBe(true);
  });
});

describe("POST /api/auth/signup", () => {
  it("requires all fields", async () => {
    expectError(await api("POST", "/api/auth/signup", { json: { email: testEmail("s") } }), 400, "All fields are required");
  });

  it("requires password ≥ 8 chars", async () => {
    expectError(
      await api("POST", "/api/auth/signup", { json: { email: testEmail("s"), username: "u", displayName: "d", password: "short" } }),
      400, "Password must be at least 8 characters"
    );
  });

  it("requires a verified OTP", async () => {
    expectError(
      await api("POST", "/api/auth/signup", { json: { email: testEmail("unverified"), username: testUsername("unv"), displayName: "d", password: "password123" } }),
      400, "Email not verified. Please complete OTP first."
    );
  });

  it("rejects taken username", async () => {
    const existing = await createUser("taken");
    const email = testEmail("taken2");
    await api("POST", "/api/auth/send-otp", { json: { email, type: "signup" } });
    const code = await readOtp(email, "signup");
    await api("POST", "/api/auth/verify-otp", { json: { email, code, type: "signup" } });
    expectError(
      await api("POST", "/api/auth/signup", { json: { email, username: existing.username, displayName: "d", password: "password123" } }),
      409, "Username already taken."
    );
  });

  it("creates the user, sets cookie, returns token, removes OTP", async () => {
    const email = testEmail("signup-ok");
    const username = testUsername("signup-ok");
    await api("POST", "/api/auth/send-otp", { json: { email, type: "signup" } });
    const code = await readOtp(email, "signup");
    await api("POST", "/api/auth/verify-otp", { json: { email, code, type: "signup" } });
    const res = await api("POST", "/api/auth/signup", { json: { email, username, displayName: "Signup Ok", password: "password123" } });

    expect(res.status).toBe(200);
    expectKeys(res.body, ["message", "token", "user"]);
    expect(res.body.message).toBe("Account created successfully");
    expectKeys(res.body.user, ["id", "email", "username", "displayName"]);
    expect(res.body.user).toMatchObject({ email, username, displayName: "Signup Ok" });
    expect(res.headers.get("set-cookie")).toBe(COOKIE_DEV(res.body.token));

    const jwt = decodeJwt(res.body.token);
    expect(jwt.userId).toBe(res.body.user.id);
    expect(jwt.email).toBe(email);
    expect(jwt.exp - jwt.iat).toBe(7 * 24 * 60 * 60);

    const [u] = await sql<{ is_email_verified: boolean; password_hash: string }[]>`
      SELECT is_email_verified, password_hash FROM users WHERE id = ${res.body.user.id}`;
    expect(u!.is_email_verified).toBe(true);
    expect(u!.password_hash).toMatch(/^\$2[aby]\$12\$/);
    const otps = await sql`SELECT 1 FROM otps WHERE email = ${email}`;
    expect(otps.length).toBe(0);
  });
});

describe("POST /api/auth/login", () => {
  it("requires a verified login OTP", async () => {
    const u = await createUser("login-unv");
    expectError(await api("POST", "/api/auth/login", { json: { email: u.email } }), 400, "Email not verified. Please complete OTP first.");
  });

  it("logs in after OTP, sets cookie, removes OTP", async () => {
    const u = await createUser("login-ok");
    expect((await api("POST", "/api/auth/send-otp", { json: { email: u.email, type: "login" } })).status).toBe(200);
    const code = await readOtp(u.email, "login");
    expect((await api("POST", "/api/auth/verify-otp", { json: { email: u.email, code, type: "login" } })).status).toBe(200);
    const res = await api("POST", "/api/auth/login", { json: { email: u.email } });

    expect(res.status).toBe(200);
    expectKeys(res.body, ["message", "token", "user"]);
    expect(res.body.message).toBe("Logged in successfully");
    expectKeys(res.body.user, ["id", "email", "username", "displayName", "avatarUrl", "role"]);
    expect(res.body.user.id).toBe(u.id);
    expect(res.headers.get("set-cookie")).toBe(COOKIE_DEV(res.body.token));
    const otps = await sql`SELECT 1 FROM otps WHERE email = ${u.email} AND type = 'login'`;
    expect(otps.length).toBe(0);
  });
});

describe("GET /api/auth/me", () => {
  it("401 without / with bad token", async () => {
    expectError(await api("GET", "/api/auth/me"), 401, "Unauthorized");
    expectError(await api("GET", "/api/auth/me", { token: "garbage" }), 401, "Unauthorized");
    expectError(await api("GET", "/api/auth/me", { cookie: "aura_token=garbage" }), 401, "Unauthorized");
  });

  it("returns the user via Bearer or cookie; cookie wins over header", async () => {
    const a = await createUser("me-a");
    const b = await createUser("me-b");
    const res = await api("GET", "/api/auth/me", { token: a.token });
    expect(res.status).toBe(200);
    expectKeys(res.body, ["user"]);
    expectKeys(res.body.user, [
      "id", "email", "username", "displayName", "avatarUrl", "coverUrl", "bio",
      "isCreator", "isPro", "totalDownloads", "totalUploads", "createdAt", "hasPassword", "googleLinked", "role",
    ]);
    expect(res.body.user.hasPassword).toBe(true);
    expect(res.body.user.googleLinked).toBe(false);
    expect(res.body.user.id).toBe(a.id);
    const both = await api("GET", "/api/auth/me", { token: a.token, cookie: b.cookie });
    expect(both.body.user.id).toBe(b.id);
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the cookie", async () => {
    const res = await api("POST", "/api/auth/logout");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "Logged out successfully" });
    expect(res.headers.get("set-cookie")).toBe("aura_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax");
  });
});

describe("PUT /api/auth/become-creator", () => {
  it("401 without token", async () => {
    expectError(await api("PUT", "/api/auth/become-creator"), 401, "Unauthorized");
  });

  it("makes the user a creator", async () => {
    const u = await createUser("creator");
    const res = await api("PUT", "/api/auth/become-creator", { token: u.token });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("You are now a creator!");
    expectKeys(res.body.user, ["id", "email", "username", "displayName", "avatarUrl", "coverUrl", "isCreator", "isPro"]);
    expect(res.body.user.isCreator).toBe(true);
    const viaCookie = await api("PUT", "/api/auth/become-creator", { cookie: u.cookie });
    expect(viaCookie.status).toBe(200);
  });
});
