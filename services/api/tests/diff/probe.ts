/**
 * Differential probe: send the same requests to the legacy (Hono) and new (Express)
 * servers and report any difference in status or JSON body.
 * Usage: OLD_URL=http://localhost:3101 NEW_URL=http://localhost:3102 tsx tests/diff/probe.ts
 * Only read-only requests + validation failures + a throwaway test user.
 */
import "../setup/env";
import { sql } from "../setup/db";
import { cleanupTestData } from "../setup/cleanup";
import { RUN_EMAIL_PATTERN, testEmail } from "../setup/run";
import { createUser } from "../setup/auth";

const OLD = process.env.OLD_URL!;
const NEW = process.env.NEW_URL!;

type Probe = { method: string; path: string; body?: string; headers?: Record<string, string>; ignore?: string[] };

async function call(base: string, p: Probe) {
  const headers: Record<string, string> = { "cf-connecting-ip": `10.77.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`, ...(p.headers ?? {}) };
  if (p.body !== undefined && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  const res = await fetch(base + p.path, { method: p.method, headers, body: p.body });
  const text = await res.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch { /* text */ }
  return { status: res.status, body, cache: res.headers.get("cache-control"), cookie: res.headers.get("set-cookie") };
}

function strip(v: any, ignore: string[]): any {
  if (Array.isArray(v)) return v.map((x) => strip(x, ignore));
  if (v && typeof v === "object") {
    const o: any = {};
    for (const k of Object.keys(v).sort()) if (!ignore.includes(k)) o[k] = strip(v[k], ignore);
    return o;
  }
  return v;
}

async function main() {
  const user = await createUser("diff");
  const auth = { Authorization: `Bearer ${user.token}` };
  const [wp] = await sql<{ id: string }[]>`SELECT id FROM wallpapers WHERE status='approved' AND text_embedding IS NOT NULL ORDER BY id LIMIT 1`;
  const [cat] = await sql<{ slug: string }[]>`SELECT slug FROM categories ORDER BY sort_order LIMIT 1`;
  const id = wp!.id;

  const probes: Probe[] = [
    // feeds & params
    ...["", "?limit=3", "?limit=3&limit=7", "?limit=1e2", "?limit=%20", "?limit=3&offset=2", "?limit=3&offset=abc",
      "?limit=3&offset=-1", "?limit=3&offset=1.5", "?limit=3&featured=TRUE", "?limit=3&featured=true",
      `?limit=3&category=${cat!.slug}`, "?limit=3&category=%20", "?limit=3&q=%25", "?limit=3&q=_", "?limit=3&q='%3B--",
      "?limit=3&q=%F0%9F%99%82", "?limit=3&q=+city+", "?limit=3&screen=", "?limit=3&screen=%20MOBILE%20", "?limit=3&screen=phone",
      "?limit=3&screen=mobile&screen=tablet"].map((q) => ({ method: "GET", path: `/api/wallpapers${q}` })),
    ...["", "?limit=4", "?limit=-1", "?limit=4&offset=-2", "?limit=4&offset=3", "?limit=abc", "?screen=tablet&limit=4", "?screen=x"]
      .map((q) => ({ method: "GET", path: `/api/wallpapers/trending${q}` })),
    { method: "GET", path: `/api/wallpapers/${id}` },
    { method: "GET", path: `/api/wallpapers/${id.toUpperCase()}` },
    { method: "GET", path: "/api/wallpapers/%20" },
    { method: "GET", path: "/api/wallpapers/null" },
    ...["", "?limit=3", "?limit=3&offset=2", "?limit=3&offset=-5", "?limit=3&offset=2.7", "?limit=0", "?limit=3&screen=TABLET", "?screen=bad"]
      .map((q) => ({ method: "GET", path: `/api/wallpapers/${id}/similar${q}` })),
    { method: "POST", path: "/api/wallpapers/null/download" },
    { method: "POST", path: "/api/wallpapers/trending/recalculate", headers: { "X-Admin-Secret": "" } },
    { method: "POST", path: "/api/wallpapers/reembed-text", headers: { "X-Admin-Secret": "x" } },
    // search (keyword mode is deterministic; semantic is compared on ids only via ignore)
    ...["", "?q=", "?q=%20a%20", "?q=ab&mode=keyword", "?q=forest&mode=keyword&limit=3", "?q=forest&mode=keyword&limit=3&offset=3",
      "?q=forest&mode=keyword&offset=-1", "?q=%25%25&mode=keyword", "?q=forest&mode=KEYWORD&limit=2", "?q=forest&mode=keyword&screen=mobile&limit=3",
      "?screen=bad&q=forest", "?q=x&screen=bad"].map((q) => ({ method: "GET", path: `/api/search${q}` })),
    ...["", "?limit=0", "?limit=-4", "?limit=12", "?limit=abc", "?screen=mobile&limit=12", "?screen=x"].map((q) => ({ method: "GET", path: `/api/search/suggestions${q}` })),
    ...["", "?q=a", "?q=DA", "?q=da&limit=3", "?q=da&limit=0", "?q=%25", "?q=da&screen=tablet", "?q=da&screen=x"].map((q) => ({ method: "GET", path: `/api/search/autocomplete${q}` })),
    { method: "GET", path: "/api/categories" },
    { method: "GET", path: "/api/collections/public" },
    // auth validation
    ...[undefined, "{}", '{"email":""}', '{"email":5,"type":"signup"}', '{"email":"a@b","type":"signup"}', '{"type":"login"}',
      `{"email":"${testEmail("nobody")}","type":"login"}`, `{"email":"${user.email}","type":"signup"}`]
      .map((body) => ({ method: "POST", path: "/api/auth/send-otp", body })),
    ...["{}", `{"email":"${testEmail("q")}","code":"1"}`, `{"email":"${testEmail("q")}","code":"123456","type":"signup"}`, `{"email":"${testEmail("q")}","code":0,"type":"signup"}`]
      .map((body) => ({ method: "POST", path: "/api/auth/verify-otp", body })),
    ...["{}", '{"email":"a","username":"u","displayName":"d"}', '{"email":"a","username":"u","displayName":"d","password":"short"}',
      '{"email":"a","username":"u","displayName":"d","password":12345678}', '{"email":"a","username":"u","displayName":"d","password":"longenough"}']
      .map((body) => ({ method: "POST", path: "/api/auth/signup", body })),
    { method: "POST", path: "/api/auth/login", body: "{}" },
    { method: "POST", path: "/api/auth/login", body: `{"email":"${user.email}"}` },
    { method: "GET", path: "/api/auth/me", headers: { Authorization: "bearer " + user.token } },
    { method: "GET", path: "/api/auth/me", headers: { Authorization: "Bearer" } },
    { method: "GET", path: "/api/auth/me", headers: { Cookie: `foo=1; aura_token=${user.token}; bar=2` } },
    { method: "GET", path: "/api/auth/me", headers: { Cookie: "aura_token=", ...auth } },
    { method: "GET", path: "/api/auth/me", headers: auth, ignore: [] },
    // authenticated validation paths (no writes succeed)
    { method: "POST", path: "/api/wallpapers/upload-url", body: '{"fileType":"image/gif"}', headers: auth },
    { method: "POST", path: "/api/wallpapers/upload-url", body: "{}", headers: auth },
    { method: "POST", path: "/api/wallpapers/upload", body: "{}", headers: auth },
    { method: "GET", path: "/api/likes", headers: auth },
    { method: "GET", path: `/api/likes/${id}`, headers: auth },
    { method: "GET", path: "/api/likes/not-a-uuid", headers: auth },
    { method: "GET", path: "/api/collections", headers: auth },
    { method: "POST", path: "/api/collections", body: '{"title":""}', headers: auth },
    { method: "POST", path: "/api/collections", body: '{"title":5}', headers: auth },
    { method: "PUT", path: "/api/collections/00000000-0000-4000-8000-000000000000", body: "{}", headers: auth },
    { method: "PUT", path: "/api/collections/not-a-uuid", body: "{}", headers: auth },
    { method: "POST", path: "/api/collections/00000000-0000-4000-8000-000000000000/wallpapers", body: "{}", headers: auth },
    { method: "GET", path: "/api/collections/saved-ids", headers: auth },
    { method: "GET", path: `/api/collections/check/${id}`, headers: auth },
    { method: "GET", path: "/api/collections/not-a-uuid" },
    { method: "GET", path: "/api/collections/x/y", headers: auth },
    { method: "GET", path: "/api/profile", headers: auth, ignore: [] },
    { method: "PUT", path: "/api/profile", body: `{"username":"${user.username}"}`, headers: auth, ignore: ["usernameChangedAt"] },
    { method: "POST", path: "/api/profile/avatar/upload-url", body: '{"fileType":"image/bmp"}', headers: auth },
    { method: "PUT", path: "/api/profile/avatar", body: '{"key":"x"}', headers: auth },
    { method: "PUT", path: "/api/profile/cover", body: '{"key":"covers/other/x.png","fileUrl":"u"}', headers: auth },
    { method: "POST", path: "/api/profile/change-password/verify", body: '{"currentPassword":"wrong-one"}', headers: auth },
    { method: "POST", path: "/api/profile/change-password/confirm", body: '{"otp":"1"}', headers: auth },
    { method: "POST", path: "/api/profile/change-password/confirm", body: '{"otp":"1","newPassword":"short"}', headers: auth },
    { method: "POST", path: "/api/profile/change-password/confirm", body: '{"otp":"1","newPassword":"longenough"}', headers: auth },
    { method: "GET", path: "/api/profile/uploads?limit=0&offset=-3", headers: auth },
    { method: "PUT", path: "/api/profile/uploads/00000000-0000-4000-8000-000000000000", body: '{"title":"x"}', headers: auth },
    { method: "PUT", path: "/api/profile/uploads/00000000-0000-4000-8000-000000000000", body: "{}", headers: auth },
    { method: "DELETE", path: "/api/profile/uploads/not-a-uuid", headers: auth },
    { method: "DELETE", path: "/api/profile", body: '{"password":"wrong-pass"}', headers: auth },
    // unauthenticated
    ...["/api/profile", "/api/profile/uploads", "/api/likes", "/api/collections"].map((path) => ({ method: "GET", path })),
  ];

  let mismatches = 0;
  for (const p of probes) {
    const [a, b] = [await call(OLD, p), await call(NEW, p)];
    const ignore = p.ignore ?? [];
    const same =
      a.status === b.status &&
      JSON.stringify(strip(a.body, ignore)) === JSON.stringify(strip(b.body, ignore)) &&
      a.cache === b.cache &&
      a.cookie === b.cookie;
    if (!same) {
      mismatches++;
      console.log(`✗ ${p.method} ${p.path} ${p.body ?? ""}`);
      console.log(`    old: ${a.status} cache=${a.cache} ${JSON.stringify(a.body).slice(0, 200)}`);
      console.log(`    new: ${b.status} cache=${b.cache} ${JSON.stringify(b.body).slice(0, 200)}`);
    }
  }
  console.log(`\n${probes.length} probes, ${mismatches} mismatches`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(async () => { await cleanupTestData(RUN_EMAIL_PATTERN); await sql.end(); });
