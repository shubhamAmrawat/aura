import { describe, expect, it } from "vitest";
import { api } from "../setup/http";
import { sql } from "../setup/db";
import { createUser, readOtp } from "../setup/auth";
import { testEmail } from "../setup/run";
import { expectError, expectKeys } from "../setup/assert";
import { useTestCleanup } from "../setup/lifecycle";

useTestCleanup();

const INVALID = "Invalid email or password.";
const login = (email: string, password: string) => api("POST", "/api/auth/login/password", { json: { email, password } });

describe("POST /api/auth/login/password", () => {
  it("validates input", async () => {
    expectError(await api("POST", "/api/auth/login/password", { json: {} }), 400, "Email and password are required");
    expectError(await api("POST", "/api/auth/login/password", { json: { email: "a@b.co" } }), 400, "Email and password are required");
  });

  it("unknown email and wrong password give the same 401", async () => {
    const u = await createUser("pw-basic");
    expectError(await login(testEmail("pw-nobody"), "whatever-123"), 401, INVALID);
    expectError(await login(u.email, "wrong-password"), 401, INVALID);
  });

  it("logs in (case-insensitive email) with the same response + cookie as OTP login", async () => {
    const u = await createUser("pw-ok");
    const res = await login(u.email.toUpperCase(), u.password);
    expect(res.status).toBe(200);
    expectKeys(res.body, ["message", "token", "user"]);
    expect(res.body.message).toBe("Logged in successfully");
    expectKeys(res.body.user, ["id", "email", "username", "displayName", "avatarUrl"]);
    expect(res.body.user.id).toBe(u.id);
    expect(res.headers.get("set-cookie")).toBe(`aura_token=${res.body.token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax`);
    const me = await api("GET", "/api/auth/me", { token: res.body.token });
    expect(me.body.user.id).toBe(u.id);
  });

  it("accounts without a password get the generic 401", async () => {
    const u = await createUser("pw-none");
    await sql`UPDATE users SET password_hash = NULL WHERE id = ${u.id}`;
    expectError(await login(u.email, u.password), 401, INVALID);
  });

  it("locks after 5 failures for 15 minutes, even for the right password; reset unlocks", async () => {
    const u = await createUser("pw-lock");
    for (let i = 0; i < 4; i++) expectError(await login(u.email, "wrong-password"), 401, INVALID);
    const fifth = await login(u.email, "wrong-password");
    expect(fifth.status).toBe(429);
    expect(fifth.body.error).toBe("Too many failed attempts. Try again in 15 minutes, or sign in with a code.");
    expect((await login(u.email, u.password)).status).toBe(429);

    await api("POST", "/api/auth/forgot-password", { json: { email: u.email } });
    const code = await readOtp(u.email, "password_reset");
    expect((await api("POST", "/api/auth/reset-password", { json: { email: u.email, otp: code, newPassword: "Brand-new-pass-1" } })).status).toBe(200);
    expect((await login(u.email, "Brand-new-pass-1")).status).toBe(200);
    const [row] = await sql<{ f: number; l: Date | null }[]>`SELECT failed_login_attempts AS f, locked_until AS l FROM users WHERE id = ${u.id}`;
    expect(row).toEqual({ f: 0, l: null });
  });

  it("a successful login resets the failure counter", async () => {
    const u = await createUser("pw-reset-count");
    for (let i = 0; i < 3; i++) await login(u.email, "wrong-password");
    expect((await login(u.email, u.password)).status).toBe(200);
    const [row] = await sql<{ f: number }[]>`SELECT failed_login_attempts AS f FROM users WHERE id = ${u.id}`;
    expect(row!.f).toBe(0);
  });
});

describe("forgot / reset password", () => {
  const GENERIC = { message: "If an account exists, we've sent a code." };

  it("forgot: validation + same answer for unknown and known emails", async () => {
    expectError(await api("POST", "/api/auth/forgot-password", { json: {} }), 400, "Email is required");
    expectError(await api("POST", "/api/auth/forgot-password", { json: { email: "nope" } }), 400, "Invalid email format");

    const unknown = testEmail("fp-unknown");
    const r1 = await api("POST", "/api/auth/forgot-password", { json: { email: unknown } });
    expect(r1.status).toBe(200);
    expect(r1.body).toEqual(GENERIC);
    expect((await sql`SELECT 1 FROM otps WHERE email = ${unknown}`).length).toBe(0);

    const u = await createUser("fp-known");
    const r2 = await api("POST", "/api/auth/forgot-password", { json: { email: u.email } });
    expect(r2.body).toEqual(GENERIC);
    const first = await readOtp(u.email, "password_reset");
    // within 60s: no new code is generated
    await api("POST", "/api/auth/forgot-password", { json: { email: u.email } });
    expect(await readOtp(u.email, "password_reset")).toBe(first);
  });

  it("reset: validation, wrong code, success; old password stops working", async () => {
    expectError(await api("POST", "/api/auth/reset-password", { json: {} }), 400, "Email and new password are required");
    expectError(await api("POST", "/api/auth/reset-password", { json: { email: "a@b.co", otp: "1", newPassword: "short" } }), 400, "Password must be at least 8 characters");
    expectError(await api("POST", "/api/auth/reset-password", { json: { email: testEmail("rp-nobody"), otp: "123456", newPassword: "longenough1" } }), 400, "Invalid OTP. Please request a new one.");

    const u = await createUser("rp-ok");
    await api("POST", "/api/auth/forgot-password", { json: { email: u.email } });
    const code = await readOtp(u.email, "password_reset");
    const wrong = code === "000000" ? "111111" : "000000";
    expectError(await api("POST", "/api/auth/reset-password", { json: { email: u.email, otp: wrong, newPassword: "longenough1" } }), 400, "Incorrect OTP.");
    const ok = await api("POST", "/api/auth/reset-password", { json: { email: u.email, otp: code, newPassword: "longenough1" } });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ message: "Password reset successfully. You can now log in." });
    expectError(await login(u.email, u.password), 401, INVALID);
    expect((await login(u.email, "longenough1")).status).toBe(200);
    expect((await sql`SELECT 1 FROM otps WHERE email = ${u.email} AND type = 'password_reset'`).length).toBe(0);
  });

  it("3-step flow: verify code first, then reset without the code", async () => {
    expectError(await api("POST", "/api/auth/forgot-password/verify", { json: {} }), 400, "Email and code are required");
    expectError(await api("POST", "/api/auth/forgot-password/verify", { json: { email: testEmail("vr-nobody"), otp: "123456" } }), 400, "Invalid OTP. Please request a new one.");

    const u = await createUser("vr-ok");
    // no verified code yet → can't reset without one
    await api("POST", "/api/auth/forgot-password", { json: { email: u.email } });
    expectError(await api("POST", "/api/auth/reset-password", { json: { email: u.email, newPassword: "longenough1" } }), 400, "Your code has expired. Please request a new one.");

    const code = await readOtp(u.email, "password_reset");
    const wrong = code === "000000" ? "111111" : "000000";
    expectError(await api("POST", "/api/auth/forgot-password/verify", { json: { email: u.email, otp: wrong } }), 400, "Incorrect OTP. 2 attempts remaining.");
    const v = await api("POST", "/api/auth/forgot-password/verify", { json: { email: u.email.toUpperCase(), otp: code } });
    expect(v.status).toBe(200);
    expect(v.body).toEqual({ message: "Code verified", verified: true });
    // the verified code can't be re-verified
    expectError(await api("POST", "/api/auth/forgot-password/verify", { json: { email: u.email, otp: code } }), 400, "Invalid OTP. Please request a new one.");

    expect((await api("POST", "/api/auth/reset-password", { json: { email: u.email, newPassword: "longenough1" } })).status).toBe(200);
    expect((await login(u.email, "longenough1")).status).toBe(200);
    // single use: the verification is consumed
    expectError(await api("POST", "/api/auth/reset-password", { json: { email: u.email, newPassword: "another-pass-2" } }), 400, "Your code has expired. Please request a new one.");
  });

  it("an expired verification can't be used", async () => {
    const u = await createUser("vr-exp");
    await api("POST", "/api/auth/forgot-password", { json: { email: u.email } });
    const code = await readOtp(u.email, "password_reset");
    expect((await api("POST", "/api/auth/forgot-password/verify", { json: { email: u.email, otp: code } })).status).toBe(200);
    await sql`UPDATE otps SET expires_at = NOW() - interval '1 minute' WHERE email = ${u.email} AND type = 'password_reset'`;
    expectError(await api("POST", "/api/auth/reset-password", { json: { email: u.email, newPassword: "longenough1" } }), 400, "Your code has expired. Please request a new one.");
  });

  it("a passwordless account can set a password via reset", async () => {
    const u = await createUser("rp-none");
    await sql`UPDATE users SET password_hash = NULL WHERE id = ${u.id}`;
    await api("POST", "/api/auth/forgot-password", { json: { email: u.email } });
    const code = await readOtp(u.email, "password_reset");
    expect((await api("POST", "/api/auth/reset-password", { json: { email: u.email, otp: code, newPassword: "first-password-1" } })).status).toBe(200);
    expect((await login(u.email, "first-password-1")).status).toBe(200);
  });
});

describe("POST /api/auth/google (real verification)", () => {
  it("validates input and rejects invalid tokens", async () => {
    expectError(await api("POST", "/api/auth/google", { json: {} }), 400, "Google credential is required");
    expectError(await api("POST", "/api/auth/google", { json: { credential: "not-a-jwt" } }), 401, "Google sign-in failed.");
    // a structurally valid but unsigned JWT
    const fake = [
      Buffer.from(JSON.stringify({ alg: "RS256", kid: "x" })).toString("base64url"),
      Buffer.from(JSON.stringify({ sub: "1", email: "a@b.co", aud: process.env.GOOGLE_CLIENT_ID })).toString("base64url"),
      "sig",
    ].join(".");
    expectError(await api("POST", "/api/auth/google", { json: { credential: fake } }), 401, "Google sign-in failed.");
  });
});

describe("account deletion without a password", () => {
  it("password accounts can't request a delete code", async () => {
    const u = await createUser("del-haspw");
    expectError(await api("POST", "/api/profile/delete/otp", { token: u.token }), 400, "Use your password to delete your account.");
  });

  it("passwordless accounts confirm with an emailed code", async () => {
    const u = await createUser("del-nopw");
    await sql`UPDATE users SET password_hash = NULL WHERE id = ${u.id}`;
    const profile = await api("GET", "/api/profile", { token: u.token });
    expect(profile.body.user.hasPassword).toBe(false);

    const sent = await api("POST", "/api/profile/delete/otp", { token: u.token });
    expect(sent.status).toBe(200);
    expect(sent.body).toEqual({ message: "We've sent a code to your email." });
    expectError(await api("DELETE", "/api/profile", { token: u.token, json: {} }), 400, "Verification code is required.");
    const code = await readOtp(u.email, "account_delete");
    const wrong = code === "000000" ? "111111" : "000000";
    expectError(await api("DELETE", "/api/profile", { token: u.token, json: { otp: wrong } }), 400, "Incorrect OTP.");
    const ok = await api("DELETE", "/api/profile", { token: u.token, json: { otp: code } });
    expect(ok.body).toEqual({ message: "Account deleted successfully." });
    expect((await sql`SELECT 1 FROM users WHERE id = ${u.id}`).length).toBe(0);
  });
});
