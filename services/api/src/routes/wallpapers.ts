import { Hono } from "hono";
import { db } from "@aura/db";
import { wallpapers } from "@aura/db";
import { and, desc, eq } from "drizzle-orm";

export const wallpaperRoutes = new Hono();

// GET /api/wallpapers?featured=true&limit=20&category=nature
wallpaperRoutes.get("/", async (c) => {
  try {
    const featured = c.req.query("featured");
    const limit = Number(c.req.query("limit")) || 20;

    const conditions = [eq(wallpapers.status, "approved")];

    if (featured === "true") {
      conditions.push(eq(wallpapers.isFeatured, true));
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

