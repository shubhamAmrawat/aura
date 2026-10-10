import { describe, expect, it } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { z } from "zod";
import { requireAuth, optionalAuth } from "../../src/middleware/auth";
import { requireAdminSecret } from "../../src/middleware/adminSecret";
import { validateBody } from "../../src/middleware/validate";
import { singleImage } from "../../src/middleware/upload";
import { errorHandler } from "../../src/middleware/errorHandler";
import { notFound } from "../../src/middleware/notFound";
import { route } from "../../src/utils/asyncRoute";
import { ApiError } from "../../src/utils/ApiError";
import { generateToken } from "../../src/utils/jwt";

function makeApp(register: (app: express.Express) => void) {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  register(app);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

const token = generateToken({ userId: "user-1", email: "u@x.y" });

describe("requireAuth / optionalAuth", () => {
  const app = makeApp((a) => {
    a.get("/private", requireAuth, (req, res) => { res.json({ userId: req.userId, email: req.userEmail }); });
    a.get("/maybe", optionalAuth, (req, res) => { res.json({ userId: req.userId ?? null }); });
  });

  it("401 without token or with a bad one", async () => {
    expect((await request(app).get("/private")).body).toEqual({ error: "Unauthorized" });
    expect((await request(app).get("/private").set("Authorization", "Bearer nope")).status).toBe(401);
  });

  it("accepts Bearer and cookie; cookie wins", async () => {
    expect((await request(app).get("/private").set("Authorization", `Bearer ${token}`)).body).toEqual({ userId: "user-1", email: "u@x.y" });
    const other = generateToken({ userId: "user-2", email: "o@x.y" });
    const both = await request(app).get("/private").set("Authorization", `Bearer ${token}`).set("Cookie", `aura_token=${other}`);
    expect(both.body.userId).toBe("user-2");
  });

  it("optionalAuth never rejects", async () => {
    expect((await request(app).get("/maybe")).body).toEqual({ userId: null });
    expect((await request(app).get("/maybe").set("Authorization", "Bearer bad")).body).toEqual({ userId: null });
    expect((await request(app).get("/maybe").set("Authorization", `Bearer ${token}`)).body).toEqual({ userId: "user-1" });
  });
});

describe("requireAdminSecret", () => {
  const app = makeApp((a) => a.post("/admin", requireAdminSecret, (_req, res) => { res.json({ ok: true }); }));
  it("checks X-Admin-Secret", async () => {
    expect((await request(app).post("/admin")).status).toBe(401);
    expect((await request(app).post("/admin").set("X-Admin-Secret", "wrong")).status).toBe(401);
    expect((await request(app).post("/admin").set("X-Admin-Secret", "unit-admin")).body).toEqual({ ok: true });
  });
});

describe("validateBody + errorHandler", () => {
  const app = makeApp((a) => {
    a.post("/v", validateBody(z.object({ title: z.string({ error: "Title is required" }).trim().min(1, "Title is required") })),
      (req, res) => { res.json(req.body); });
    a.get("/api-error", () => { throw new ApiError(418, "teapot"); });
    a.get("/boom", () => { throw new Error("secret details"); });
    a.get("/route-fallback", route("Failed to fetch things", async () => { throw new Error("db down"); }));
    a.get("/route-known", route("Failed", async () => { throw new ApiError(404, "Thing not found"); }));
    a.get("/route-401", route("Unauthorized", async () => { throw new Error("x"); }, 401));
  });

  it("zod: first message as 400, trimmed output", async () => {
    expect((await request(app).post("/v").send({ title: "   " })).body).toEqual({ error: "Title is required" });
    expect((await request(app).post("/v").send({ title: "  Hi " })).body).toEqual({ title: "Hi" });
  });

  it("malformed JSON → 400", async () => {
    const res = await request(app).post("/v").set("Content-Type", "application/json").send("{bad");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid JSON body" });
  });

  it("ApiError passthrough, unknown errors hidden, route fallbacks", async () => {
    expect((await request(app).get("/api-error"))).toMatchObject({ status: 418, body: { error: "teapot" } });
    const boom = await request(app).get("/boom");
    expect(boom.status).toBe(500);
    expect(boom.body).toEqual({ error: "Internal Server Error" });
    expect((await request(app).get("/route-fallback")).body).toEqual({ error: "Failed to fetch things" });
    expect((await request(app).get("/route-known"))).toMatchObject({ status: 404, body: { error: "Thing not found" } });
    expect((await request(app).get("/route-401"))).toMatchObject({ status: 401, body: { error: "Unauthorized" } });
  });

  it("unknown route → JSON 404", async () => {
    expect((await request(app).get("/nope"))).toMatchObject({ status: 404, body: { error: "Not found" } });
  });
});

describe("singleImage (multer)", () => {
  const app = makeApp((a) =>
    a.post("/up", singleImage("avatar", 10, "Too big."), (req, res) => {
      res.json({ field: req.file?.fieldname ?? null, size: req.file?.size ?? null, type: req.file?.mimetype ?? null });
    })
  );

  it("exposes the named file only", async () => {
    const ok = await request(app).post("/up").attach("avatar", Buffer.from("12345"), { filename: "a.png", contentType: "image/png" });
    expect(ok.body).toEqual({ field: "avatar", size: 5, type: "image/png" });
    const wrongField = await request(app).post("/up").attach("other", Buffer.from("1"), "a.png");
    expect(wrongField.body.field).toBeNull();
  });

  it("size limit → 400 with the given message (exact max is allowed)", async () => {
    expect((await request(app).post("/up").attach("avatar", Buffer.alloc(10), "a.png")).body.size).toBe(10);
    const big = await request(app).post("/up").attach("avatar", Buffer.alloc(11), "a.png");
    expect(big.status).toBe(400);
    expect(big.body).toEqual({ error: "Too big." });
  });
});
