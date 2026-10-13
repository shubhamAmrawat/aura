import { and, desc, eq, gte, ilike, inArray, isNull, lt, notInArray, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../config/db";
import { adminActions, categories, users, wallpapers } from "../../models";
import type { ACTIVITY_GROUPS } from "../../validators/admin.schema";

type Group = (typeof ACTIVITY_GROUPS)[number];

const REVIEW = ["wallpaper.approve", "wallpaper.reject", "wallpaper.restore", "wallpaper.purge"];
const SYSTEM = ["admin.create", "stats.reset"];

/** Which actions belong to each filter group. */
function groupFilter(g: Group): SQL {
  const a = adminActions.action;
  switch (g) {
    case "review":
      return inArray(a, REVIEW);
    case "wallpapers":
      return and(sql`${a} LIKE 'wallpaper.%'`, notInArray(a, REVIEW))!;
    case "categories":
      return sql`${a} LIKE 'category.%'`;
    case "featured":
      return sql`${a} LIKE 'featured.%'`;
    case "users":
      return and(sql`${a} LIKE 'user.%'`, sql`${a} NOT LIKE 'user.role.%'`)!;
    case "system":
      return or(inArray(a, SYSTEM), sql`${a} LIKE 'user.role.%'`)!;
  }
}

const actor = alias(users, "actor");
const targetUser = alias(users, "target_user");

export async function listActivity(f: {
  group?: Group;
  adminId?: string;
  q?: string;
  from?: Date;
  to?: Date;
  limit: number;
  offset: number;
}) {
  const where: SQL[] = [];
  if (f.group) where.push(groupFilter(f.group));
  if (f.adminId === "system") where.push(isNull(adminActions.adminId));
  else if (f.adminId) where.push(eq(adminActions.adminId, f.adminId));
  if (f.from) where.push(gte(adminActions.createdAt, f.from));
  if (f.to) where.push(lt(adminActions.createdAt, f.to));
  if (f.q) {
    const p = `%${f.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    where.push(
      or(
        ilike(adminActions.action, p),
        ilike(adminActions.targetId, p),
        sql`${adminActions.details}::text ILIKE ${p}`,
        ilike(actor.email, p),
        ilike(wallpapers.title, p),
        ilike(categories.name, p),
        ilike(targetUser.email, p)
      )!
    );
  }
  const cond = where.length ? and(...where) : undefined;

  // Targets are joined by type so the log shows current names (and whether the thing still exists)
  const base = () =>
    db
      .select({
        id: adminActions.id,
        action: adminActions.action,
        targetType: adminActions.targetType,
        targetId: adminActions.targetId,
        details: adminActions.details,
        createdAt: adminActions.createdAt,
        admin: { id: actor.id, email: actor.email, username: actor.username },
        wallpaper: { title: wallpapers.title, fileUrl: wallpapers.fileUrl, status: wallpapers.status },
        category: { name: categories.name, slug: categories.slug },
        user: { email: targetUser.email, username: targetUser.username },
      })
      .from(adminActions)
      .leftJoin(actor, eq(actor.id, adminActions.adminId))
      .leftJoin(wallpapers, and(eq(adminActions.targetType, "wallpaper"), sql`${wallpapers.id}::text = ${adminActions.targetId}`))
      .leftJoin(categories, and(eq(adminActions.targetType, "category"), sql`${categories.id}::text = ${adminActions.targetId}`))
      .leftJoin(targetUser, and(eq(adminActions.targetType, "user"), sql`${targetUser.id}::text = ${adminActions.targetId}`));

  const [rows, [{ total } = { total: 0 }], admins, cats] = await Promise.all([
    base().where(cond).orderBy(desc(adminActions.createdAt), desc(adminActions.id)).limit(f.limit).offset(f.offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(adminActions)
      .leftJoin(actor, eq(actor.id, adminActions.adminId))
      .leftJoin(wallpapers, and(eq(adminActions.targetType, "wallpaper"), sql`${wallpapers.id}::text = ${adminActions.targetId}`))
      .leftJoin(categories, and(eq(adminActions.targetType, "category"), sql`${categories.id}::text = ${adminActions.targetId}`))
      .leftJoin(targetUser, and(eq(adminActions.targetType, "user"), sql`${targetUser.id}::text = ${adminActions.targetId}`))
      .where(cond),
    // everyone who appears in the log, for the filter
    db
      .selectDistinct({ id: actor.id, email: actor.email })
      .from(adminActions)
      .innerJoin(actor, eq(actor.id, adminActions.adminId)),
    db.select({ id: categories.id, name: categories.name }).from(categories),
  ]);

  // (drizzle returns null for a left-joined object whose row is missing)
  return {
    data: rows,
    total,
    hasMore: f.offset + rows.length < total,
    admins: admins.sort((a, b) => a.email.localeCompare(b.email)),
    /** current category names, to show the moves inside AI-suggestion entries */
    categoryNames: Object.fromEntries(cats.map((c) => [c.id, c.name])),
  };
}
