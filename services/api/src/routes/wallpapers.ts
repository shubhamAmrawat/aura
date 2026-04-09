import { Hono } from "hono";
import { categories, db, wallpapers } from "@aura/db";
import { and, desc, eq, gt, ilike, or, sql } from "drizzle-orm";

export const wallpaperRoutes = new Hono();

// GET /api/wallpapers?featured=true&limit=20&category=nature&q=forest
wallpaperRoutes.get("/", async (c) => {
  try {
    const featured = c.req.query("featured");
    const limit = Number(c.req.query("limit")) || 150;
    const categorySlug = c.req.query("category")?.trim();
    const q = c.req.query("q")?.trim();

    const conditions = [eq(wallpapers.status, "approved")];
    conditions.push(gt(wallpapers.width, wallpapers.height));
    if (featured === "true") {
      conditions.push(eq(wallpapers.isFeatured, true));
    }

    if (categorySlug) {
      const [catRow] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.slug, categorySlug))
        .limit(1);
      if (catRow) {
        conditions.push(eq(wallpapers.categoryId, catRow.id));
      } else {
        conditions.push(sql`1 = 0`);
      }
    }

    if (q) {
      const pattern = `%${q}%`;
      conditions.push(
        or(
          ilike(wallpapers.title, pattern),
          ilike(wallpapers.description, pattern),
          sql`array_to_string(${wallpapers.tags}, ' ') ILIKE ${pattern}`
        )!
      );
    }

    const result = await db
      .select()
      .from(wallpapers)
      .where(and(...conditions))
      .orderBy(desc(wallpapers.createdAt))
      .limit(limit);

    return c.json({
      data: result,
      count: result.length,
    });
  } catch (error) {
    console.error("Wallpapers error:", error);
    return c.json({ error: "Failed to fetch wallpapers" }, 500);
  }
});

// GET /api/wallpapers/:id — get single wallpaper
wallpaperRoutes.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");

    const result = await db
      .select()
      .from(wallpapers)
      .where(eq(wallpapers.id, id))
      .limit(1);

    if (result.length === 0) {
      return c.json({ error: "Wallpaper not found" }, 404);
    }

    return c.json({ data: result[0] });
  } catch (error) {
    console.error("Wallpapers error:", error);
    return c.json({ error: "Failed to fetch wallpapers" }, 500);
  }
});


// POST /api/wallpapers/:id/download — track download
wallpaperRoutes.post("/:id/download", async (c) => {
  try {
    const id = c.req.param("id");
    await db
      .update(wallpapers)
      .set({ downloadCount: sql`${wallpapers.downloadCount} + 1` })
      .where(eq(wallpapers.id, id));
    return c.json({ message: "Download tracked" });
  } catch (error) {
    console.error("Download track error:", error);
    return c.json({ error: "Failed to track download" }, 500);
  }
});
