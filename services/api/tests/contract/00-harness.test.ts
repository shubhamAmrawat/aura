import { afterAll, describe, expect, it } from "vitest";
import { api } from "../setup/http";
import { sql } from "../setup/db";
import { createUser } from "../setup/auth";
import { cleanupTestData } from "../setup/cleanup";
import { RUN_EMAIL_PATTERN } from "../setup/run";

// Proves the test harness itself works before any real contract tests are trusted.
describe("harness", () => {
  afterAll(async () => {
    await cleanupTestData(RUN_EMAIL_PATTERN);
    await sql.end();
  });

  it("server is reachable", async () => {
    const res = await api("GET", "/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("can create a test user and authenticate with Bearer and cookie", async () => {
    const user = await createUser("harness");
    expect(user.email).toMatch(/^aura-test\+.+@example\.com$/);

    const viaBearer = await api("GET", "/api/auth/me", { token: user.token });
    expect(viaBearer.status).toBe(200);
    expect(viaBearer.body.user.id).toBe(user.id);

    const viaCookie = await api("GET", "/api/auth/me", { cookie: user.cookie });
    expect(viaCookie.status).toBe(200);
    expect(viaCookie.body.user.id).toBe(user.id);
  });

  it("cleanup removes this run's users and nothing else", async () => {
    const before = await sql<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM users WHERE email NOT LIKE 'aura-test+%@example.com'`;
    const result = await cleanupTestData(RUN_EMAIL_PATTERN);
    expect(result.users).toBe(1);
    const after = await sql<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM users WHERE email NOT LIKE 'aura-test+%@example.com'`;
    expect(after[0]!.n).toBe(before[0]!.n); // real users untouched
    const mine = await sql`SELECT 1 FROM users WHERE email LIKE ${RUN_EMAIL_PATTERN}`;
    expect(mine.length).toBe(0);
  });
});
