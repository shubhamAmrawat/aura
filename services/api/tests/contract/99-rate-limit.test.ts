import { describe, expect, it } from "vitest";
import { api } from "../setup/http";
import { expectError } from "../setup/assert";
import { useTestCleanup } from "../setup/lifecycle";

useTestCleanup();

const rand = () => Math.floor(Math.random() * 250) + 1;

describe("rate limiting (in-memory, keyed by x-forwarded-for)", () => {
  it("100 requests/min per IP, then 429", async () => {
    const ip = `192.168.${rand()}.${rand()}`;
    for (let i = 0; i < 100; i++) {
      const r = await api("GET", "/health", { ip });
      expect(r.status).toBe(200);
    }
    expectError(await api("GET", "/health", { ip }), 429, "Too many requests. Please slow down.");
    // a different IP is unaffected
    expect((await api("GET", "/health")).status).toBe(200);
  });

  it("KNOWN BUG (Phase 9): the 10/hour upload limiter never fires", async () => {
    // Hono's "/api/wallpapers/upload*" pattern never matches the real routes, so in prod
    // uploads are only covered by the global 100/min limit. Express keeps this behaviour.
    const ip = `172.20.${rand()}.${rand()}`;
    for (let i = 0; i < 12; i++) {
      const r = await api("POST", "/api/wallpapers/upload-url", { ip, json: { fileType: "image/png" } });
      expect(r.status).toBe(401);
    }
  });
});
