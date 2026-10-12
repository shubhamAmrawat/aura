import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../config/db";
import { categories, categorySuggestions, wallpapers } from "../../models";
import { ApiError } from "../../utils/ApiError";
import { logAdminAction } from "../../utils/audit";

export type SuggestionKind = "uncategorized" | "moves";

const cur = alias(categories, "cur");
const sug = alias(categories, "sug");
const alt = alias(categories, "alt");

/** pending suggestions of one kind: wallpapers with no real category, or ones the AI says are in the wrong place */
const kindFilter = (kind: SuggestionKind) =>
  kind === "uncategorized"
    ? isNull(categorySuggestions.currentCategoryId)
    : and(isNotNull(categorySuggestions.currentCategoryId), eq(categorySuggestions.currentFits, false));

export async function listSuggestions(kind: SuggestionKind) {
  const rows = await db
    .select({
      wallpaperId: categorySuggestions.wallpaperId,
      title: wallpapers.title,
      fileUrl: wallpapers.fileUrl,
      dominantColor: wallpapers.dominantColor,
      width: wallpapers.width,
      height: wallpapers.height,
      status: wallpapers.status,
      current: { id: cur.id, name: cur.name },
      suggested: { id: sug.id, name: sug.name },
      alternative: { id: alt.id, name: alt.name },
      confidence: categorySuggestions.confidence,
      reason: categorySuggestions.reason,
      newCategoryIdea: categorySuggestions.newCategoryIdea,
    })
    .from(categorySuggestions)
    .innerJoin(wallpapers, eq(wallpapers.id, categorySuggestions.wallpaperId))
    .leftJoin(cur, eq(cur.id, categorySuggestions.currentCategoryId))
    .leftJoin(sug, eq(sug.id, categorySuggestions.suggestedCategoryId))
    .leftJoin(alt, eq(alt.id, categorySuggestions.alternativeCategoryId))
    .where(and(eq(categorySuggestions.status, "pending"), kindFilter(kind)))
    .orderBy(sql`${sug.name} NULLS LAST`, sql`${categorySuggestions.confidence} DESC`);

  // drizzle returns { id: null, name: null } for a missing left join — normalise to null
  const fix = (c: { id: string | null; name: string | null } | null) => (c && c.id ? (c as { id: string; name: string }) : null);
  const data = rows.map((r) => ({ ...r, current: fix(r.current), suggested: fix(r.suggested), alternative: fix(r.alternative) }));

  const [counts] = await db
    .select({
      uncategorized: sql<number>`count(*) FILTER (WHERE ${categorySuggestions.currentCategoryId} IS NULL)::int`,
      moves: sql<number>`count(*) FILTER (WHERE ${categorySuggestions.currentCategoryId} IS NOT NULL AND ${categorySuggestions.currentFits} = false)::int`,
    })
    .from(categorySuggestions)
    .where(eq(categorySuggestions.status, "pending"));

  return { kind, data, counts: counts ?? { uncategorized: 0, moves: 0 } };
}

/** Move the chosen wallpapers into the chosen categories and mark their suggestions applied. */
export async function applySuggestions(adminId: string | null, items: { wallpaperId: string; categoryId: string }[], status: "applied" | "auto_applied" = "applied") {
  const ids = [...new Set(items.map((i) => i.wallpaperId))];
  if (ids.length !== items.length) throw new ApiError(400, "The list contains duplicates.");
  const catIds = [...new Set(items.map((i) => i.categoryId))];
  const found = await db.select({ id: categories.id }).from(categories).where(inArray(categories.id, catIds));
  if (found.length !== catIds.length) throw new ApiError(400, "One of the chosen categories no longer exists. Refresh and try again.");

  const pending = await db
    .select({ id: categorySuggestions.wallpaperId, from: wallpapers.categoryId })
    .from(categorySuggestions)
    .innerJoin(wallpapers, eq(wallpapers.id, categorySuggestions.wallpaperId))
    .where(and(inArray(categorySuggestions.wallpaperId, ids), eq(categorySuggestions.status, "pending")));
  const fromById = new Map(pending.map((p) => [p.id, p.from]));
  const todo = items.filter((i) => fromById.has(i.wallpaperId)); // already handled elsewhere → skipped

  await db.transaction(async (tx) => {
    for (const i of todo) {
      await tx.update(wallpapers).set({ categoryId: i.categoryId, updatedAt: new Date() }).where(eq(wallpapers.id, i.wallpaperId));
    }
    if (todo.length) {
      await tx
        .update(categorySuggestions)
        .set({ status, resolvedAt: new Date(), resolvedBy: adminId })
        .where(inArray(categorySuggestions.wallpaperId, todo.map((i) => i.wallpaperId)));
      await logAdminAction(
        {
          adminId,
          action: status === "auto_applied" ? "category.suggestions.auto_apply" : "category.suggestions.apply",
          targetType: "wallpaper",
          details: { count: todo.length, moves: todo.map((i) => ({ id: i.wallpaperId, from: fromById.get(i.wallpaperId) ?? null, to: i.categoryId })) },
        },
        tx
      );
    }
  });
  return { applied: todo.length, skipped: items.length - todo.length };
}

export async function dismissSuggestions(adminId: string, wallpaperIds: string[]) {
  const res = await db
    .update(categorySuggestions)
    .set({ status: "dismissed", resolvedAt: new Date(), resolvedBy: adminId })
    .where(and(inArray(categorySuggestions.wallpaperId, wallpaperIds), eq(categorySuggestions.status, "pending")))
    .returning({ id: categorySuggestions.wallpaperId });
  if (res.length) {
    await logAdminAction({ adminId, action: "category.suggestions.dismiss", targetType: "wallpaper", details: { count: res.length, ids: res.map((r) => r.id) } });
  }
  return { dismissed: res.length };
}
