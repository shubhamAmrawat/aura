/**
 * One-off category cleanup (2026-10-13). Dry run by default; pass --apply to write.
 *   1. Merge Urban → City and Landscape → Nature (wallpapers move, old slugs redirect)
 *   2. Rename slug hindusm → hinduism (old slug redirects)
 *   3. Auto-apply AI suggestions for uncategorized wallpapers where the AI and the
 *      vector check agree (the AI's pick is among the 2 nearest category centroids).
 *      Everything else stays pending for review in /admin/categories/review.
 *
 *   node --env-file=../../.env --import tsx scripts/category-cleanup.mts [--apply]
 */
import { sql as dsql } from "drizzle-orm";

const load = async <T,>(p: string): Promise<T> => { const m: any = await import(p); return (m.default ?? m) as T; };
const { db } = await load<typeof import("../src/config/db")>("../src/config/db");
const cats = await load<typeof import("../src/services/admin/categories.service")>("../src/services/admin/categories.service");
const sug = await load<typeof import("../src/services/admin/categorySuggestions.service")>("../src/services/admin/categorySuggestions.service");

const APPLY = process.argv.includes("--apply");
const q = async <T,>(s: ReturnType<typeof dsql>) => (await db.execute(s)) as unknown as T[];

const [admin] = await q<{ id: string; email: string }>(dsql`SELECT id, email FROM users WHERE role = 'admin' AND email NOT LIKE 'aura-test+%' ORDER BY created_at LIMIT 1`);
if (!admin) throw new Error("No admin account found");
const slugMap = new Map((await q<{ id: string; slug: string; name: string }>(dsql`SELECT id, slug, name FROM categories`)).map((c) => [c.slug, c]));
const need = (s: string) => { const c = slugMap.get(s); if (!c) throw new Error(`category ${s} not found`); return c; };

console.log(`${APPLY ? "APPLYING" : "DRY RUN"} as ${admin.email}`);

// 1 + 2: merges and rename (skipped if already done)
for (const [from, to] of [["urban", "city"], ["landscape", "nature"]] as const) {
  if (!slugMap.has(from)) { console.log(`merge ${from} → ${to}: already done`); continue; }
  const [{ n }] = await q<{ n: number }>(dsql`SELECT count(*)::int n FROM wallpapers WHERE category_id = ${need(from).id}`);
  console.log(`merge ${from} → ${to}: ${n} wallpapers`);
  if (APPLY) console.log("  ", await cats.deleteCategory(admin.id, need(from).id, need(to).id));
}
if (slugMap.has("hindusm")) {
  console.log("rename slug hindusm → hinduism");
  if (APPLY) { const r = await cats.updateCategory(admin.id, need("hindusm").id, { slug: "hinduism" }); console.log("  ", r.slug); }
} else console.log("rename hindusm → hinduism: already done");

// 3: auto-apply where two independent signals agree
const rows = await q<{ id: string; cur: string | null; sug: string | null; fits: boolean | null; e: string }>(dsql`
  SELECT s.wallpaper_id id, s.current_category_id cur, s.suggested_category_id sug, s.current_fits fits, w.text_embedding::text e
  FROM category_suggestions s JOIN wallpapers w ON w.id = s.wallpaper_id
  WHERE s.status = 'pending' AND w.text_embedding IS NOT NULL`);
const norm = (v: number[]) => { const n = Math.hypot(...v); return v.map((x) => x / n); };
const items = rows.map((r) => ({ ...r, v: norm(JSON.parse(r.e) as number[]) }));
const sums = new Map<string, number[]>();
for (const i of items) if (i.cur && i.fits) { const s = sums.get(i.cur) ?? new Array(i.v.length).fill(0); i.v.forEach((x, k) => (s[k] += x)); sums.set(i.cur, s); }
const cents = [...sums].map(([id, s]) => [id, norm(s)] as const);
const top2 = (v: number[]) => cents.map(([id, c]) => [id, c.reduce((a, x, k) => a + x * v[k]!, 0)] as const).sort((a, b) => b[1] - a[1]).slice(0, 2).map((x) => x[0]);

const auto = items.filter((i) => !i.cur && i.sug && top2(i.v).includes(i.sug)).map((i) => ({ wallpaperId: i.id, categoryId: i.sug! }));
const reviewUnc = items.filter((i) => !i.cur).length - auto.length;
const reviewMoves = items.filter((i) => i.cur && i.fits === false).length;
const byCat = new Map<string, number>(); for (const a of auto) byCat.set(a.categoryId, (byCat.get(a.categoryId) ?? 0) + 1);
const nameOf = new Map([...slugMap.values()].map((c) => [c.id, c.name]));
console.log(`auto-apply ${auto.length}:`, [...byCat].sort((a, b) => b[1] - a[1]).map(([id, n]) => `${nameOf.get(id)} ${n}`).join(", "));
console.log(`left for review: ${reviewUnc} uncategorized + ${reviewMoves} probable moves`);
if (APPLY && auto.length) console.log("  ", await sug.applySuggestions(null, auto, "auto_applied"));

const [{ n: uncLeft }] = await q<{ n: number }>(dsql`SELECT count(*)::int n FROM wallpapers w JOIN categories c ON c.id = w.category_id WHERE c.slug = 'uncategorized'`);
console.log(`wallpapers still in Uncategorized: ${uncLeft}`);
process.exit(0);
