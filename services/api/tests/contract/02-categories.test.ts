import { describe, expect, it } from "vitest";
import { api } from "../setup/http";
import { expectKeys } from "../setup/assert";
import { useTestCleanup } from "../setup/lifecycle";

useTestCleanup();

describe("GET /api/categories", () => {
  it("returns all categories sorted by sortOrder with cache header", async () => {
    const res = await api("GET", "/api/categories");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, s-maxage=86400, stale-while-revalidate=604800");
    expectKeys(res.body, ["data"]);
    const data = res.body.data as any[];
    expect(data.length).toBeGreaterThan(0);
    for (const c of data) {
      expectKeys(c, ["id", "name", "slug", "description", "coverImageUrl", "coverThumbUrl", "sortOrder", "wallpaperCount"]);
      expect(Number.isInteger(c.wallpaperCount) && c.wallpaperCount >= 0).toBe(true);
      if (c.coverThumbUrl !== null) expect(c.coverThumbUrl).toMatch(/\/categories\/thumbs\/[0-9a-f-]{36}-[0-9a-f]{10}\.webp$/);
    }
    expect(data.some((c) => c.wallpaperCount > 0)).toBe(true);
    for (let i = 1; i < data.length; i++) expect(data[i - 1].sortOrder).toBeLessThanOrEqual(data[i].sortOrder);
  });

  it("?screen=mobile counts only phone wallpapers and drops empty categories", async () => {
    const [all, mobile, tablet] = await Promise.all([
      api("GET", "/api/categories"),
      api("GET", "/api/categories?screen=mobile"),
      api("GET", "/api/categories?screen=tablet"),
    ]);
    expect(mobile.status).toBe(200);
    expect(tablet.status).toBe(200);
    const byId = new Map((all.body.data as any[]).map((c) => [c.id, c]));
    for (const list of [mobile.body.data as any[], tablet.body.data as any[]]) {
      for (const c of list) {
        expect(c.wallpaperCount).toBeGreaterThan(0);
        expect(c.wallpaperCount).toBeLessThanOrEqual(byId.get(c.id).wallpaperCount);
      }
      for (let i = 1; i < list.length; i++) expect(list[i - 1].sortOrder).toBeLessThanOrEqual(list[i].sortOrder);
    }
    const m = new Map((mobile.body.data as any[]).map((c) => [c.id, c.wallpaperCount]));
    const t = new Map((tablet.body.data as any[]).map((c) => [c.id, c.wallpaperCount]));
    for (const c of all.body.data as any[]) expect((m.get(c.id) ?? 0) + (t.get(c.id) ?? 0)).toBe(c.wallpaperCount);
  });

  it("rejects an unknown screen value", async () => {
    const res = await api("GET", "/api/categories?screen=watch");
    expect(res.status).toBe(400);
  });
});
