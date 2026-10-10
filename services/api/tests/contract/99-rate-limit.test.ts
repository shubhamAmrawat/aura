import { describe, expect, it } from "vitest";
import { api } from "../setup/http";
import { expectError } from "../setup/assert";
import { useTestCleanup } from "../setup/lifecycle";

useTestCleanup();

const rand = () => Math.floor(Math.random() * 250) + 1;

describe("rate limiting (in-memory, keyed by CF-Connecting-IP / socket IP)", () => {
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

  it("X-Forwarded-For can no longer be used to dodge the limit", async () => {
    const ip = `192.169.${rand()}.${rand()}`;
    for (let i = 0; i < 100; i++) {
      const r = await api("GET", "/health", { ip, headers: { "x-forwarded-for": `9.9.${rand()}.${rand()}` } });
      expect(r.status).toBe(200);
    }
    expectError(
      await api("GET", "/health", { ip, headers: { "x-forwarded-for": "8.8.8.8" } }),
      429, "Too many requests. Please slow down."
    );
  });
});
