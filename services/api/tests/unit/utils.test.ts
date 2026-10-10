import { describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { generateToken, verifyToken } from "../../src/utils/jwt";
import { generateOTP, getOTPExpiry, isOTPExpired } from "../../src/utils/otp";
import { parseScreenFilter } from "../../src/utils/screenFilter";
import { parseOrThrow } from "../../src/utils/validate";
import { ApiError } from "../../src/utils/ApiError";

describe("jwt", () => {
  it("round-trips payload with 7-day expiry", () => {
    const token = generateToken({ userId: "u1", email: "a@b.c" });
    const payload = verifyToken(token) as any;
    expect(payload).toMatchObject({ userId: "u1", email: "a@b.c" });
    expect(payload.exp - payload.iat).toBe(604800);
  });

  it("rejects tokens signed with another secret", () => {
    const forged = jwt.sign({ userId: "x", email: "y" }, "other-secret");
    expect(() => verifyToken(forged)).toThrow();
  });
});

describe("otp", () => {
  it("is always 6 digits", () => {
    for (let i = 0; i < 200; i++) expect(generateOTP()).toMatch(/^\d{6}$/);
  });

  it("expires 15 minutes from now", () => {
    const diff = getOTPExpiry().getTime() - Date.now();
    expect(diff).toBeGreaterThan(14.9 * 60_000);
    expect(diff).toBeLessThanOrEqual(15 * 60_000);
    expect(isOTPExpired(new Date(Date.now() - 1))).toBe(true);
    expect(isOTPExpired(new Date(Date.now() + 60_000))).toBe(false);
  });
});

describe("parseScreenFilter", () => {
  it("accepts mobile/tablet in any case, ignores empty", () => {
    expect(parseScreenFilter(undefined)).toBeNull();
    expect(parseScreenFilter("")).toBeNull();
    expect(parseScreenFilter(" Mobile ")).toBe("mobile");
    expect(parseScreenFilter("TABLET")).toBe("tablet");
  });

  it("throws 400 on anything else", () => {
    try {
      parseScreenFilter("desktop");
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(400);
      expect((e as ApiError).message).toBe("Invalid screen value. Use 'mobile' or 'tablet'.");
    }
  });
});

describe("parseOrThrow", () => {
  const schema = z.object({
    a: z.string({ error: "A is required" }).min(1, "A is required"),
    b: z.string({ error: "B is required" }),
  });

  it("returns parsed data", () => {
    expect(parseOrThrow(schema, { a: "x", b: "y", extra: 1 })).toEqual({ a: "x", b: "y" });
  });

  it("throws the FIRST issue message as 400 (field order)", () => {
    expect(() => parseOrThrow(schema, {})).toThrow("A is required");
    expect(() => parseOrThrow(schema, undefined)).toThrow("A is required");
    expect(() => parseOrThrow(schema, { a: "x" })).toThrow("B is required");
  });
});

describe("cookies", () => {
  it("dev vs prod Set-Cookie strings", async () => {
    const res = { setHeader: vi.fn() } as any;
    const dev = await import("../../src/utils/cookies");
    dev.setAuthCookie(res, "T");
    expect(res.setHeader).toHaveBeenLastCalledWith("Set-Cookie", "aura_token=T; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax");
    dev.clearAuthCookie(res);
    expect(res.setHeader).toHaveBeenLastCalledWith("Set-Cookie", "aura_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax");

    vi.resetModules();
    process.env.NODE_ENV = "production";
    const prod = await import("../../src/utils/cookies");
    prod.setAuthCookie(res, "T");
    expect(res.setHeader).toHaveBeenLastCalledWith(
      "Set-Cookie", "aura_token=T; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax; Domain=.aurora-walls.com; Secure"
    );
    prod.clearAuthCookie(res);
    expect(res.setHeader).toHaveBeenLastCalledWith("Set-Cookie", "aura_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax; Domain=.aurora-walls.com");
    process.env.NODE_ENV = "test";
  });
});
