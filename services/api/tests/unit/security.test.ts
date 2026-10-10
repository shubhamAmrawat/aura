import { describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { getClientIp } from "../../src/middleware/rateLimit";

describe("getClientIp", () => {
  const app = express();
  app.get("/ip", (req, res) => { res.json({ ip: getClientIp(req) }); });

  it("uses CF-Connecting-IP when present", async () => {
    const res = await request(app).get("/ip").set("CF-Connecting-IP", "203.0.113.7").set("X-Forwarded-For", "1.1.1.1");
    expect(res.body.ip).toBe("203.0.113.7");
  });

  it("ignores X-Forwarded-For and falls back to the socket address", async () => {
    const res = await request(app).get("/ip").set("X-Forwarded-For", "1.1.1.1");
    expect(res.body.ip).not.toBe("1.1.1.1");
    expect(res.body.ip).toMatch(/127\.0\.0\.1|::1|::ffff:127\.0\.0\.1/);
  });
});

describe("requireAdminSecret fails closed", () => {
  it("rejects everything when ADMIN_SECRET is unset", async () => {
    const saved = process.env.ADMIN_SECRET;
    delete process.env.ADMIN_SECRET;
    vi.resetModules();
    try {
      const { requireAdminSecret } = await import("../../src/middleware/adminSecret");
      const { errorHandler } = await import("../../src/middleware/errorHandler");
      const app = express();
      app.post("/admin", requireAdminSecret, (_req, res) => { res.json({ ok: true }); });
      app.use(errorHandler);
      expect((await request(app).post("/admin")).status).toBe(401);
      expect((await request(app).post("/admin").set("X-Admin-Secret", "")).status).toBe(401);
    } finally {
      process.env.ADMIN_SECRET = saved;
      vi.resetModules();
    }
  });
});
