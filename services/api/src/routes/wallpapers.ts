import { Hono } from "hono";
import { db } from "@aura/db";
import { wallpapers } from "@aura/db";
import { desc, eq } from "drizzle-orm";

export const wallpaperRoutes = new Hono();

// GET /api/wallpapers — get all wallpapers
wallpaperRoutes.get("/", async (c) => {
  try {
    const result = await db
      .select()
      .from(wallpapers)
      .where(eq(wallpapers.status, "approved"))
      .orderBy(desc(wallpapers.createdAt))
      .limit(20);

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