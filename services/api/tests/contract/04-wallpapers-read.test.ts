import { beforeAll, describe, expect, it } from "vitest";
import { api } from "../setup/http";
import { sql } from "../setup/db";
import { createUser, type TestUser } from "../setup/auth";
import { createTestWallpaper } from "../setup/fixtures";
import { expectError, expectKeys, expectSortedDesc, NONEXISTENT_UUID, WALLPAPER_LIST_KEYS } from "../setup/assert";
import { useTestCleanup } from "../setup/lifecycle";

useTestCleanup();

const SCREEN_ERR = "Invalid screen value. Use 'mobile' or 'tablet'.";

let owner: TestUser;
let pendingId: string;
let noEmbeddingId: string;

beforeAll(async () => {
  owner = await createUser("wp-read");
  pendingId = await createTestWallpaper(owner);
  noEmbeddingId = await createTestWallpaper(owner, { noEmbedding: true });
});

function expectFeedShape(body: any) {
  expectKeys(body, ["data", "count", "hasMore"]);
  expect(body.count).toBe(body.data.length);
  for (const w of body.data) {
    expectKeys(w, WALLPAPER_LIST_KEYS);
    expect(w.status).toBe("approved");
  }
}

describe("GET /api/wallpapers", () => {
  it("default: up to 150 newest approved, no-store", async () => {
    const res = await api("GET", "/api/wallpapers");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expectFeedShape(res.body);
    expect(res.body.data.length).toBeLessThanOrEqual(150);
    expect(res.body.hasMore).toBe(res.body.data.length === 150);
    const times = res.body.data.map((w: any) => new Date(w.createdAt).getTime());
    expectSortedDesc(times);
    expect(res.body.data.some((w: any) => w.id === pendingId)).toBe(false);
  });

  it("limit handling: explicit, clamp to 100, invalid → 30", async () => {
    const five = await api("GET", "/api/wallpapers?limit=5");
    expect(five.body.data.length).toBe(5);
    expect(five.body.hasMore).toBe(true);
    expect((await api("GET", "/api/wallpapers?limit=500")).body.data.length).toBe(100);
    expect((await api("GET", "/api/wallpapers?limit=abc")).body.data.length).toBe(30);
    expect((await api("GET", "/api/wallpapers?limit=0")).body.data.length).toBe(30);
    expect((await api("GET", "/api/wallpapers?limit=-3")).body.data.length).toBe(30);
    expect((await api("GET", "/api/wallpapers?limit=7.9")).body.data.length).toBe(7);
  });

  it("offset pagination is consistent", async () => {
    const ten = (await api("GET", "/api/wallpapers?limit=10")).body.data.map((w: any) => w.id);
    const p2 = (await api("GET", "/api/wallpapers?limit=5&offset=5")).body.data.map((w: any) => w.id);
    expect(p2).toEqual(ten.slice(5, 10));
  });

  it("featured filter", async () => {
    const res = await api("GET", "/api/wallpapers?featured=true&limit=50");
    expectFeedShape(res.body);
    for (const w of res.body.data) expect(w.isFeatured).toBe(true);
  });

  it("category filter (real slug, unknown slug)", async () => {
    const [cat] = await sql<{ id: string; slug: string }[]>`
      SELECT c.id, c.slug FROM categories c
      WHERE EXISTS (SELECT 1 FROM wallpapers w WHERE w.category_id = c.id AND w.status = 'approved')
      ORDER BY c.sort_order LIMIT 1`;
    const res = await api("GET", `/api/wallpapers?category=${cat!.slug}&limit=20`);
    expectFeedShape(res.body);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const w of res.body.data) expect(w.categoryId).toBe(cat!.id);
    const none = await api("GET", "/api/wallpapers?category=__no_such_category__");
    expect(none.body).toEqual({ data: [], count: 0, hasMore: false });
  });

  it("q keyword filter", async () => {
    const [row] = await sql<{ tag: string }[]>`
      SELECT tags[1] AS tag FROM wallpapers WHERE status = 'approved' AND cardinality(tags) > 0 LIMIT 1`;
    const res = await api("GET", `/api/wallpapers?q=${encodeURIComponent(row!.tag)}&limit=20`);
    expectFeedShape(res.body);
    expect(res.body.data.length).toBeGreaterThan(0);
    const none = await api("GET", "/api/wallpapers?q=zzqqxx_nothing_matches_this");
    expect(none.body.data).toEqual([]);
  });

  it("screen filter", async () => {
    const m = await api("GET", "/api/wallpapers?screen=mobile&limit=30");
    for (const w of m.body.data) expect(w.isMobile).toBe(true);
    const t = await api("GET", "/api/wallpapers?screen=TABLET&limit=30");
    for (const w of t.body.data) expect(w.isMobile).toBe(false);
    expectError(await api("GET", "/api/wallpapers?screen=desktop"), 400, SCREEN_ERR);
  });
});

describe("GET /api/wallpapers/trending", () => {
  it("default 50, sorted by trendingScore desc, approved only", async () => {
    const res = await api("GET", "/api/wallpapers/trending");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expectFeedShape(res.body);
    expect(res.body.data.length).toBe(50);
    expect(res.body.hasMore).toBe(true);
    expectSortedDesc(res.body.data.map((w: any) => w.trendingScore));
  });

  it("limit clamp + offset + screen", async () => {
    expect((await api("GET", "/api/wallpapers/trending?limit=1000")).body.data.length).toBe(100);
    expect((await api("GET", "/api/wallpapers/trending?limit=0")).body.data.length).toBe(50);
    const ten = (await api("GET", "/api/wallpapers/trending?limit=10")).body.data.map((w: any) => w.id);
    const p2 = (await api("GET", "/api/wallpapers/trending?limit=5&offset=5")).body.data.map((w: any) => w.id);
    expect(p2).toEqual(ten.slice(5, 10));
    for (const w of (await api("GET", "/api/wallpapers/trending?screen=mobile&limit=20")).body.data) expect(w.isMobile).toBe(true);
    expectError(await api("GET", "/api/wallpapers/trending?screen=x"), 400, SCREEN_ERR);
  });
});

describe("GET /api/wallpapers/:id", () => {
  it("returns every column except textEmbedding, with cache header", async () => {
    const [real] = await sql<{ id: string }[]>`SELECT id FROM wallpapers WHERE status = 'approved' LIMIT 1`;
    const res = await api("GET", `/api/wallpapers/${real!.id}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, s-maxage=300, stale-while-revalidate=600");
    expectKeys(res.body, ["data"]);
    expectKeys(res.body.data, [
      "id", "title", "description", "fileUrl", "cdnVariants", "blurhash", "dominantColor", "palette",
      "width", "height", "fileSizeBytes", "format", "categoryId", "uploaderId", "tags", "isPremium",
      "isFeatured", "isAiGenerated", "isMobile", "downloadCount", "likeCount", "viewCount",
      "trendingScore", "status", "createdAt", "updatedAt", "embedding", "extraCategoryIds",
    ]);
    expect(res.body.data.id).toBe(real!.id);
  });

  it("does not filter by status (pending is still returned)", async () => {
    const res = await api("GET", `/api/wallpapers/${pendingId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("pending");
  });

  it("404 for unknown id, 500 for malformed id", async () => {
    expectError(await api("GET", `/api/wallpapers/${NONEXISTENT_UUID}`), 404, "Wallpaper not found");
    expectError(await api("GET", "/api/wallpapers/not-a-uuid"), 500, "Failed to fetch wallpapers");
  });
});

describe("GET /api/wallpapers/:id/similar", () => {
  const SIMILAR_KEYS = [
    "id", "title", "description", "file_url", "thumb_url", "blurhash", "dominant_color", "palette", "width", "height",
    "like_count", "download_count", "view_count", "format", "file_size_bytes", "category_id", "tags",
    "semantic_score", "category_bonus", "hybrid_score",
  ];

  it("hybrid-ranked neighbours, snake_case rows, cache header", async () => {
    const [real] = await sql<{ id: string }[]>`
      SELECT id FROM wallpapers WHERE status = 'approved' AND text_embedding IS NOT NULL LIMIT 1`;
    const res = await api("GET", `/api/wallpapers/${real!.id}/similar`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, s-maxage=1800, stale-while-revalidate=3600");
    expectKeys(res.body, ["data", "hasMore"]);
    expect(res.body.data.length).toBe(24);
    expect(res.body.hasMore).toBe(true);
    for (const w of res.body.data) {
      expectKeys(w, SIMILAR_KEYS);
      expect(w.id).not.toBe(real!.id);
      expect(w.id).not.toBe(pendingId);
    }
    expectSortedDesc(res.body.data.map((w: any) => Number(w.hybrid_score)));
  });

  it("pagination, clamp, screen", async () => {
    const [real] = await sql<{ id: string }[]>`
      SELECT id FROM wallpapers WHERE status = 'approved' AND text_embedding IS NOT NULL LIMIT 1`;
    expect((await api("GET", `/api/wallpapers/${real!.id}/similar?limit=80`)).body.data.length).toBe(50);
    const ten = (await api("GET", `/api/wallpapers/${real!.id}/similar?limit=10`)).body.data.map((w: any) => w.id);
    const p2 = (await api("GET", `/api/wallpapers/${real!.id}/similar?limit=5&offset=5`)).body.data.map((w: any) => w.id);
    expect(p2).toEqual(ten.slice(5, 10));
    const mob = (await api("GET", `/api/wallpapers/${real!.id}/similar?screen=mobile&limit=20`)).body.data.map((w: any) => w.id);
    const flags = await sql<{ is_mobile: boolean }[]>`SELECT is_mobile FROM wallpapers WHERE id = ANY(${mob}::uuid[])`;
    for (const f of flags) expect(f.is_mobile).toBe(true);
    expectError(await api("GET", `/api/wallpapers/${real!.id}/similar?screen=x`), 400, SCREEN_ERR);
  });

  it("source without embedding → empty; unknown → 404", async () => {
    const res = await api("GET", `/api/wallpapers/${noEmbeddingId}/similar`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [], hasMore: false });
    expect(res.headers.get("cache-control")).toBeNull();
    expectError(await api("GET", `/api/wallpapers/${NONEXISTENT_UUID}/similar`), 404, "Wallpaper not found");
  });
});

describe("POST /api/wallpapers/:id/download", () => {
  const counts = async (id: string) => {
    const [w] = await sql<{ n: number }[]>`SELECT download_count AS n FROM wallpapers WHERE id = ${id}`;
    const [u] = await sql<{ n: number }[]>`SELECT total_downloads AS n FROM users WHERE id = ${owner.id}`;
    const [d] = await sql<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM downloads WHERE wallpaper_id = ${id}`;
    return { wallpaper: w!.n, uploader: u!.n, rows: d!.n };
  };

  it("anonymous downloads always count, are logged, and credit the uploader", async () => {
    const before = await counts(pendingId);
    for (let i = 0; i < 2; i++) {
      const res = await api("POST", `/api/wallpapers/${pendingId}/download`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: "Download tracked" });
    }
    const after = await counts(pendingId);
    expect(after).toEqual({ wallpaper: before.wallpaper + 2, uploader: before.uploader + 2, rows: before.rows + 2 });
    const rows = await sql`SELECT user_id, quality FROM downloads WHERE wallpaper_id = ${pendingId} ORDER BY created_at DESC LIMIT 1`;
    expect(rows[0]).toEqual({ user_id: null, quality: "original" });
  });

  it("logged-in user counts once per 24h (every download still logged with quality)", async () => {
    const downloader = await createUser("wp-downloader");
    const before = await counts(pendingId);
    await api("POST", `/api/wallpapers/${pendingId}/download`, { token: downloader.token, json: { quality: "4k" } });
    await api("POST", `/api/wallpapers/${pendingId}/download`, { cookie: downloader.cookie });
    const after = await counts(pendingId);
    expect(after).toEqual({ wallpaper: before.wallpaper + 1, uploader: before.uploader + 1, rows: before.rows + 2 });
    const rows = await sql<{ quality: string }[]>`
      SELECT quality FROM downloads WHERE user_id = ${downloader.id} ORDER BY created_at`;
    expect(rows.map((r) => r.quality)).toEqual(["4k", "original"]);
  });

  it("unknown id still 200 (no-op), malformed id 500", async () => {
    expect((await api("POST", `/api/wallpapers/${NONEXISTENT_UUID}/download`)).body).toEqual({ message: "Download tracked" });
    expectError(await api("POST", "/api/wallpapers/not-a-uuid/download"), 500, "Failed to track download");
  });
});

describe("POST /api/wallpapers/:id/view", () => {
  const views = async (id: string) =>
    (await sql<{ n: number }[]>`SELECT view_count AS n FROM wallpapers WHERE id = ${id}`)[0]!.n;

  it("counts views on approved wallpapers only", async () => {
    // Approved fixture is dated 2000-01-01 and has no embedding, so it sorts last in every
    // feed and never appears in semantic/similar results; it's deleted right after.
    const approvedId = await createTestWallpaper(owner, { status: "approved", noEmbedding: true, createdAt: new Date("2000-01-01") });
    try {
      const res = await api("POST", `/api/wallpapers/${approvedId}/view`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: "View tracked" });
      await api("POST", `/api/wallpapers/${approvedId}/view`);
      expect(await views(approvedId)).toBe(2);
    } finally {
      await sql`DELETE FROM wallpapers WHERE id = ${approvedId}`;
    }
    await api("POST", `/api/wallpapers/${pendingId}/view`);
    expect(await views(pendingId)).toBe(0);
  });

  it("unknown id 200 (no-op), malformed id 500", async () => {
    expect((await api("POST", `/api/wallpapers/${NONEXISTENT_UUID}/view`)).body).toEqual({ message: "View tracked" });
    expectError(await api("POST", "/api/wallpapers/not-a-uuid/view"), 500, "Failed to track view");
  });
});

describe("admin endpoints (auth check only — never executed)", () => {
  it("trending/recalculate rejects missing/wrong secret", async () => {
    expectError(await api("POST", "/api/wallpapers/trending/recalculate"), 401, "Unauthorized");
    expectError(await api("POST", "/api/wallpapers/trending/recalculate", { headers: { "X-Admin-Secret": "wrong" } }), 401, "Unauthorized");
  });

  it("reembed-text rejects missing/wrong secret", async () => {
    expectError(await api("POST", "/api/wallpapers/reembed-text"), 401, "Unauthorized");
    expectError(await api("POST", "/api/wallpapers/reembed-text", { headers: { "X-Admin-Secret": "wrong" } }), 401, "Unauthorized");
  });
});
