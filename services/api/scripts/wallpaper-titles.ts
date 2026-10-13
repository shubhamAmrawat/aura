/**
 * Give real titles to live wallpapers whose title is a tag list, a URL/catalogue line or too long,
 * and flag ones that show a game / film / comic / anime franchise.
 *   npx tsx --env-file=../../.env scripts/wallpaper-titles.ts            → dry run (everything printed, nothing saved)
 *   npx tsx --env-file=../../.env scripts/wallpaper-titles.ts --apply    → save titles; franchise ones move to the
 *                                                                          hidden "Games & franchises" category
 * The old title's keywords are kept as tags (up to 10 tags).
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "../src/config/db";
import { categories, wallpapers } from "../src/models";
import { getOpenAI } from "../src/integrations/openai";
import { visibleCategorySql } from "../src/utils/screenFilter";
import { thumbUrlSql } from "../src/services/wallpaperThumb.service";
import { logAdminAction } from "../src/utils/audit";

const HIDDEN_SLUG = "games-franchises";

const badTitle = sql`(
  length(${wallpapers.title}) - length(replace(${wallpapers.title}, ',', '')) >= 2
  OR ${wallpapers.title} ~* '(https?://|www\\.)'
  OR length(${wallpapers.title}) > 90
  OR ${wallpapers.title} ~ '^[0-9 _.-]+$'
)`;

const SYSTEM = [
  "You name wallpapers for a gallery. Return JSON {\"title\": string, \"franchise\": string | null}.",
  "title: 3–8 words, Title Case, describes what is visible (subject, setting, mood). No quotes, no trailing period,",
  "no brand, franchise, character or real-person names, no words like 'wallpaper', '4K', 'HD'.",
  "franchise: if the image shows a recognisable character, scene or asset from a video game, film, TV series, anime,",
  "manga or comic (or the old title names one), give that franchise's name; otherwise null.",
  "Car makes, real landmarks, artists of public-domain paintings and generic subjects are NOT franchises.",
].join(" ");

async function nameIt(imageUrl: string, oldTitle: string, tags: string[]) {
  try {
    const res = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 80,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
            { type: "text", text: `Old title: ${oldTitle.slice(0, 300)}\nTags: ${tags.join(", ") || "none"}` },
          ],
        },
      ],
    });
    const parsed = JSON.parse(res.choices[0]?.message?.content ?? "{}") as { title?: unknown; franchise?: unknown };
    const title = String(parsed.title ?? "").replace(/["“”]/g, "").replace(/\.$/, "").trim().slice(0, 100);
    const franchise = typeof parsed.franchise === "string" && parsed.franchise.trim() ? parsed.franchise.trim() : null;
    return title.length >= 3 ? { title, franchise } : null;
  } catch (e) {
    console.error("  ! failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Old comma-separated title → extra tags (short, no URLs), merged into the existing tags. */
function mergeTags(tags: string[], oldTitle: string) {
  const extra = oldTitle
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length >= 2 && t.length <= 30 && !/https?:|www\.|[0-9]{4,}/.test(t));
  const out = [...tags];
  for (const t of extra) if (!out.some((x) => x.toLowerCase() === t)) out.push(t);
  return out.slice(0, 10);
}

async function hiddenCategoryId() {
  const [found] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, HIDDEN_SLUG)).limit(1);
  if (found) return found.id;
  const [m] = await db.select({ m: sql<number>`coalesce(max(${categories.sortOrder}), 0)` }).from(categories);
  const [created] = await db
    .insert(categories)
    .values({ name: "Games & franchises", slug: HIDDEN_SLUG, description: "Kept off the public site (copyrighted characters and game art).", sortOrder: (m?.m ?? 0) + 1, isHidden: true })
    .returning({ id: categories.id });
  await logAdminAction({ adminId: null, action: "category.create", targetType: "category", targetId: created!.id, details: { name: "Games & franchises", slug: HIDDEN_SLUG, hidden: true } });
  return created!.id;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const rows = await db
    .select({ id: wallpapers.id, title: wallpapers.title, tags: wallpapers.tags, fileUrl: wallpapers.fileUrl, thumbUrl: thumbUrlSql })
    .from(wallpapers)
    .where(and(eq(wallpapers.status, "approved"), visibleCategorySql, badTitle));
  console.log(`${rows.length} live wallpapers with a tag-list / URL / overlong title. ${apply ? "Saving…" : "Dry run:"}`);

  const results: { id: string; old: string; title: string; franchise: string | null; tags: string[] }[] = [];
  let failed = 0;
  let i = 0;
  const worker = async () => {
    while (i < rows.length) {
      const r = rows[i++]!;
      const named = await nameIt(r.thumbUrl ?? r.fileUrl, r.title, r.tags ?? []);
      if (!named) { failed++; continue; }
      results.push({ id: r.id, old: r.title, ...named, tags: mergeTags(r.tags ?? [], r.title) });
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));

  const flagged = results.filter((r) => r.franchise);
  for (const r of results) console.log(`${r.franchise ? `[${r.franchise}] ` : ""}${r.old.slice(0, 70)}  →  ${r.title}`);
  console.log(`\n${results.length} named, ${failed} failed, ${flagged.length} show a franchise.`);

  if (apply) {
    const hiddenId = flagged.length ? await hiddenCategoryId() : null;
    for (const r of results) {
      await db.update(wallpapers).set({ title: r.title, tags: r.tags, updatedAt: new Date(), ...(r.franchise && hiddenId ? { categoryId: hiddenId } : {}) }).where(eq(wallpapers.id, r.id));
      await logAdminAction({
        adminId: null,
        action: "wallpaper.update",
        targetType: "wallpaper",
        targetId: r.id,
        details: { title: r.title, changes: { title: { from: r.old, to: r.title }, ...(r.franchise ? { categoryId: { to: HIDDEN_SLUG }, franchise: r.franchise } : {}) } },
      });
    }
    console.log(`Saved ${results.length} titles; moved ${flagged.length} to the hidden "${HIDDEN_SLUG}" category.`);
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
