import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../config/db";
import { categories, userInterests } from "../models";
import { ApiError } from "../utils/ApiError";

/** Most categories a user can pick. */
export const MAX_INTERESTS = 4;

/** The user's picked categories, first pick first (hidden categories left out). */
export async function getInterests(userId: string) {
  return db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      coverThumbUrl: categories.coverThumbUrl,
      coverImageUrl: categories.coverImageUrl,
    })
    .from(userInterests)
    .innerJoin(categories, eq(categories.id, userInterests.categoryId))
    .where(and(eq(userInterests.userId, userId), eq(categories.isHidden, false)))
    .orderBy(asc(userInterests.position));
}

/** Replaces the user's picks with `categoryIds` (in order). An empty list clears them. */
export async function setInterests(userId: string, categoryIds: string[]) {
  const ids = [...new Set(categoryIds)];
  if (ids.length > MAX_INTERESTS) throw new ApiError(400, `Pick up to ${MAX_INTERESTS} categories.`);

  if (ids.length) {
    const found = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(inArray(categories.id, ids), eq(categories.isHidden, false)));
    if (found.length !== ids.length) throw new ApiError(400, "One or more categories don't exist.");
  }

  await db.transaction(async (tx) => {
    await tx.delete(userInterests).where(eq(userInterests.userId, userId));
    if (ids.length) {
      await tx.insert(userInterests).values(ids.map((categoryId, i) => ({ userId, categoryId, position: i + 1 })));
    }
  });
  return getInterests(userId);
}
