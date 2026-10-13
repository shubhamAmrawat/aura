import { describe, expect, it } from "vitest";
import { api } from "../setup/http";
import { sql } from "../setup/db";
import { expectError, expectKeys, expectSortedDesc } from "../setup/assert";
import { useTestCleanup } from "../setup/lifecycle";

useTestCleanup();

const SCREEN_ERR = "Invalid screen value. Use 'mobile' or 'tablet'.";
const SEMANTIC_KEYS = [
  "id", "title", "file_url", "thumb_url", "blurhash", "dominant_color", "palette", "width", "height", "like_count",
  "download_count", "view_count", "trending_score", "is_featured", "is_premium", "tags", "category_id",
  "status", "created_at", "format", "file_size_bytes", "semantic_score", "keyword_boost", "hybrid_score",
];
const KEYWORD_KEYS = [
  "id", "title", "fileUrl", "thumbUrl", "blurhash", "dominantColor", "palette", "width", "height", "likeCount",
  "downloadCount", "viewCount", "trendingScore", "isFeatured", "isPremium", "tags", "categoryId",
  "status", "createdAt", "format", "fileSizeBytes",
];
const EDITORIAL = [
  "neon city", "amoled minimal", "dark abstract", "cozy rainy evening",
  "peaceful mountain morning", "futuristic cyberpunk", "space art", "anime aesthetic",
];

describe("GET /api/search", () => {
  it("short/missing query → empty, mode none", async () => {
    expect((await api("GET", "/api/search")).body).toEqual({ data: [], hasMore: false, mode: "none" });
    expect((await api("GET", "/api/search?q=a")).body).toEqual({ data: [], hasMore: false, mode: "none" });
  });

  it("invalid screen → 400 (checked before q)", async () => {
    expectError(await api("GET", "/api/search?screen=watch"), 400, SCREEN_ERR);
  });

  it("hybrid (default): ranked approved rows, snake_case", async () => {
    const res = await api("GET", "/api/search?q=neon%20city");
    expect(res.status).toBe(200);
    expectKeys(res.body, ["data", "hasMore", "mode"]);
    expect(res.body.mode).toBe("hybrid");
    expect(res.body.data.length).toBe(20);
    expect(res.body.hasMore).toBe(true);
    for (const w of res.body.data) {
      expectKeys(w, SEMANTIC_KEYS);
      expect(w.status).toBe("approved");
    }
    expectSortedDesc(res.body.data.map((w: any) => Number(w.hybrid_score)));
  });

  it("semantic mode label, limit clamp, offset", async () => {
    const res = await api("GET", "/api/search?q=dark%20forest&mode=semantic&limit=200");
    expect(res.body.mode).toBe("semantic");
    expect(res.body.data.length).toBe(50);
    const ten = (await api("GET", "/api/search?q=dark%20forest&limit=10")).body.data.map((w: any) => w.id);
    const p2 = (await api("GET", "/api/search?q=dark%20forest&limit=5&offset=5")).body.data.map((w: any) => w.id);
    expect(p2).toEqual(ten.slice(5, 10));
  });

  it("screen filter applies to semantic results", async () => {
    const ids = (await api("GET", "/api/search?q=mountain&screen=mobile&limit=20")).body.data.map((w: any) => w.id);
    expect(ids.length).toBeGreaterThan(0);
    const flags = await sql<{ is_mobile: boolean }[]>`SELECT is_mobile FROM wallpapers WHERE id = ANY(${ids}::uuid[])`;
    for (const f of flags) expect(f.is_mobile).toBe(true);
  });

  it("keyword mode: camelCase rows sorted by trendingScore", async () => {
    const [row] = await sql<{ tag: string }[]>`
      SELECT tags[1] AS tag FROM wallpapers WHERE status = 'approved' AND cardinality(tags) > 0 LIMIT 1`;
    const res = await api("GET", `/api/search?q=${encodeURIComponent(row!.tag)}&mode=keyword`);
    expect(res.body.mode).toBe("keyword");
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const w of res.body.data) {
      expectKeys(w, KEYWORD_KEYS);
      expect(w.status).toBe("approved");
    }
    expectSortedDesc(res.body.data.map((w: any) => w.trendingScore));
    const none = await api("GET", "/api/search?q=zzqqxx_nothing&mode=keyword");
    expect(none.body).toEqual({ data: [], hasMore: false, mode: "keyword" });
  });
});

describe("GET /api/search/suggestions", () => {
  it("default 8 = editorial seeds, cache header", async () => {
    const res = await api("GET", "/api/search/suggestions");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=120, s-maxage=300, stale-while-revalidate=600");
    expect(res.body.data).toEqual(EDITORIAL.map((term) => ({ term, source: "editorial" })));
  });

  it("limit up to 20 adds trending terms, unique + normalized", async () => {
    const res = await api("GET", "/api/search/suggestions?limit=99");
    const data = res.body.data as { term: string; source: string }[];
    expect(data.length).toBe(20);
    expect(data.slice(0, 8).map((d) => d.term)).toEqual(EDITORIAL);
    for (const d of data.slice(8)) expect(["trending-title", "trending-tag"]).toContain(d.source);
    const terms = data.map((d) => d.term);
    expect(new Set(terms).size).toBe(terms.length);
    for (const t of terms) {
      expect(t).toBe(t.trim().toLowerCase());
      expect(t.length).toBeGreaterThanOrEqual(3);
    }
    expect((await api("GET", "/api/search/suggestions?limit=3")).body.data.length).toBe(3);
  });

  it("invalid screen → 400", async () => {
    expectError(await api("GET", "/api/search/suggestions?screen=x"), 400, SCREEN_ERR);
  });
});

describe("GET /api/search/autocomplete", () => {
  it("q < 2 → empty without cache header", async () => {
    const res = await api("GET", "/api/search/autocomplete?q=a");
    expect(res.body).toEqual({ data: [] });
    expect(res.headers.get("cache-control")).toBeNull();
  });

  it("tags + short titles where the text or a word in it starts with q, unique, lowercase, ≤ limit", async () => {
    const res = await api("GET", "/api/search/autocomplete?q=Da");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=30, s-maxage=60, stale-while-revalidate=120");
    const data = res.body.data as string[];
    expect(data.length).toBeGreaterThan(0);
    expect(data.length).toBeLessThanOrEqual(8);
    expect(new Set(data).size).toBe(data.length);
    for (const t of data) {
      expect(t === t.toLowerCase()).toBe(true);
      expect(t.split(" ").some((w) => w.startsWith("da"))).toBe(true);
      expect(t.length).toBeLessThanOrEqual(40);
      expect(t.includes(",")).toBe(false);
    }
    // whole-term matches rank above mid-term word matches
    const firstWord = data.findIndex((t) => !t.startsWith("da"));
    if (firstWord >= 0) expect(data.slice(firstWord).every((t) => !t.startsWith("da"))).toBe(true);
    // wildcards are literal
    expect((await api("GET", "/api/search/autocomplete?q=%25%25")).body.data).toEqual([]);
    expect((await api("GET", "/api/search/autocomplete?q=da&limit=50")).body.data.length).toBeLessThanOrEqual(15);
  });

  it("invalid screen → 400 (before q check)", async () => {
    expectError(await api("GET", "/api/search/autocomplete?q=a&screen=x"), 400, SCREEN_ERR);
  });
});
