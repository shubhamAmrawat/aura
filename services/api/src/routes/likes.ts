import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import { db, likes, wallpapers } from "@aura/db";
import { and, desc, eq, sql } from "drizzle-orm";

type Variables = {
  userId: string;
  email: string;
}; 


export const likesRoutes = new Hono<{Variables: Variables}>(); 

likesRoutes.use("*", authMiddleware); 

// ─── TOGGLE LIKE ───────────────────────────────────────────
likesRoutes.post("/:wallpaperId", async (c) => {
  try {
    const userId = c.get("userId");
    const wallpaperId = c.req.param("wallpaperId");

    const existing = await db
      .select()
      .from(likes)
      .where(and(eq(likes.userId, userId), eq(likes.wallpaperId, wallpaperId)))
      .limit(1);

    if (existing.length > 0) {
      await db
        .delete(likes)
        .where(and(eq(likes.userId, userId), eq(likes.wallpaperId, wallpaperId)));

      await db
        .update(wallpapers)
        .set({ likeCount: sql`${wallpapers.likeCount} - 1` })
        .where(eq(wallpapers.id, wallpaperId));

      return c.json({ liked: false, message: "Unliked successfully" });
    } else {
      await db.insert(likes).values({ userId, wallpaperId });

      await db
        .update(wallpapers)
        .set({ likeCount: sql`${wallpapers.likeCount} + 1` })
        .where(eq(wallpapers.id, wallpaperId));

      return c.json({ liked: true, message: "Liked successfully" });
    }
  } catch (error) {
    console.error("Toggle like error:", error);
    return c.json({ error: "Failed to toggle like" }, 500);
  }
});

likesRoutes.get("/", async (c) => {
  try {
    const userId = c.get("userId");

    const likedWallpapers = await db
      .select({
        id: wallpapers.id,
        title: wallpapers.title,
        fileUrl: wallpapers.fileUrl,
        blurhash: wallpapers.blurhash,
        dominantColor: wallpapers.dominantColor,
        width: wallpapers.width,
        height: wallpapers.height,
        likeCount: wallpapers.likeCount,
        downloadCount: wallpapers.downloadCount,
        likedAt: likes.createdAt,
      })
      .from(likes)
      .innerJoin(wallpapers, eq(likes.wallpaperId, wallpapers.id))
      .where(eq(likes.userId, userId))
      .orderBy(desc(likes.createdAt));

    return c.json({ data: likedWallpapers });
  } catch (error) {
    console.error("Get likes error:", error);
    return c.json({ error: "Failed to fetch liked wallpapers" }, 500);
  }
});


// ─── CHECK IF WALLPAPER IS LIKED ───────────────────────────
likesRoutes.get("/:wallpaperId", async (c) => {
  try {
    const userId = c.get("userId");
    const wallpaperId = c.req.param("wallpaperId");

    const existing = await db
      .select()
      .from(likes)
      .where(and(eq(likes.userId, userId), eq(likes.wallpaperId, wallpaperId)))
      .limit(1);

    return c.json({ liked: existing.length > 0 });
  } catch (error) {
    console.error("Check like error:", error);
    return c.json({ error: "Failed to check like" }, 500);
  }
});