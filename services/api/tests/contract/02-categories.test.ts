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
    for (const c of data) expectKeys(c, ["id", "name", "slug", "description", "coverImageUrl", "sortOrder"]);
    for (let i = 1; i < data.length; i++) expect(data[i - 1].sortOrder).toBeLessThanOrEqual(data[i].sortOrder);
  });
});
