import { describe, expect, it } from "vitest";
import { api } from "../setup/http";
import { useTestCleanup } from "../setup/lifecycle";

useTestCleanup();

const ALLOWED = "https://www.aurora-walls.com";

describe("root", () => {
  it("GET / returns API identity", async () => {
    const res = await api("GET", "/");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ name: "AURA API", status: "ok" });
  });

  it("GET /health returns ok + ISO timestamp", async () => {
    const res = await api("GET", "/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
  });

  it("unknown route returns 404", async () => {
    const res = await api("GET", "/api/does-not-exist");
    expect(res.status).toBe(404);
  });
});

describe("CORS", () => {
  it("preflight from allowed origin", async () => {
    const res = await api("OPTIONS", "/api/wallpapers", {
      headers: {
        Origin: ALLOWED,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type,authorization",
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(ALLOWED);
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
    const methods = (res.headers.get("access-control-allow-methods") ?? "").split(",").map((m) => m.trim()).sort();
    expect(methods).toEqual(["DELETE", "GET", "HEAD", "PATCH", "POST", "PUT"]);
    const allowHeaders = (res.headers.get("access-control-allow-headers") ?? "").toLowerCase();
    expect(allowHeaders).toContain("content-type");
    expect(allowHeaders).toContain("authorization");
  });

  it("all allowed origins are accepted", async () => {
    for (const origin of ["https://www.aurora-walls.com", "https://aurora-walls.com", "http://localhost:3000"]) {
      const res = await api("GET", "/health", { headers: { Origin: origin } });
      expect(res.headers.get("access-control-allow-origin")).toBe(origin);
      expect(res.headers.get("access-control-allow-credentials")).toBe("true");
    }
  });

  it("disallowed origin gets no allow-origin header", async () => {
    const res = await api("GET", "/health", { headers: { Origin: "https://evil.example.com" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});
