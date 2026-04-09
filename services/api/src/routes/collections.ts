import { Hono } from "hono";
import { db } from "@aura/db";
import { collections, collectionWallpapers, wallpapers } from "@aura/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";

type Variables = {
  userId: string;
  email: string;
};

export const collectionsRoutes = new Hono<{ Variables: Variables }>();

// public routes — no auth needed
// GET /api/collections/public
collectionsRoutes.get("/public", async (c) => {
  try {
    const result = await db
      .select({
        id: collections.id,
        title: collections.title,
        description: collections.description,
        coverWallpaperId: collections.coverWallpaperId,
        userId: collections.userId,
        createdAt: collections.createdAt,
        wallpaperCount: sql<number>`count(${collectionWallpapers.wallpaperId})::int`,
      })
      .from(collections)
      .leftJoin(
        collectionWallpapers,
        eq(collections.id, collectionWallpapers.collectionId)
      )
      .where(eq(collections.isPublic, true))
      .groupBy(collections.id)
      .orderBy(desc(collections.createdAt));

    return c.json({ data: result });
  } catch (error) {
    console.error("Get public collections error:", error);
    return c.json({ error: "Failed to fetch public collections" }, 500);
  }
});

// GET /api/collections/:id — view single collection (public or owned)
collectionsRoutes.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const authHeader = c.req.header("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    // get collection
    const collectionRecord = await db
      .select()
      .from(collections)
      .where(eq(collections.id, id))
      .limit(1);

    const collection = collectionRecord[0];
    if (!collection) return c.json({ error: "Collection not found" }, 404);

    // if private, only owner can view
    if (!collection.isPublic) {
      if (!token) return c.json({ error: "Unauthorized" }, 401);
      const { verifyToken } = await import("../lib/jwt");
      const payload = verifyToken(token);
      if (payload.userId !== collection.userId) {
        return c.json({ error: "Unauthorized" }, 401);
      }
    }

    // get wallpapers in collection
    const items = await db
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
        addedAt: collectionWallpapers.addedAt,
      })
      .from(collectionWallpapers)
      .innerJoin(wallpapers, eq(collectionWallpapers.wallpaperId, wallpapers.id))
      .where(eq(collectionWallpapers.collectionId, id))
      .orderBy(desc(collectionWallpapers.addedAt));

    return c.json({
      collection: {
        ...collection,
        wallpaperCount: items.length,
      },
      wallpapers: items,
    });
  } catch (error) {
    console.error("Get collection error:", error);
    return c.json({ error: "Failed to fetch collection" }, 500);
  }
});

// all routes below require auth
collectionsRoutes.use("*", authMiddleware);

// GET /api/collections — user's own collections
collectionsRoutes.get("/", async (c) => {
  try {
    const userId = c.get("userId");

    const result = await db
      .select({
        id: collections.id,
        title: collections.title,
        description: collections.description,
        isPublic: collections.isPublic,
        coverWallpaperId: collections.coverWallpaperId,
        createdAt: collections.createdAt,
        wallpaperCount: sql<number>`count(${collectionWallpapers.wallpaperId})::int`,
      })
      .from(collections)
      .leftJoin(
        collectionWallpapers,
        eq(collections.id, collectionWallpapers.collectionId)
      )
      .where(eq(collections.userId, userId))
      .groupBy(collections.id)
      .orderBy(desc(collections.createdAt));

    return c.json({ data: result });
  } catch (error) {
    console.error("Get collections error:", error);
    return c.json({ error: "Failed to fetch collections" }, 500);
  }
});

// POST /api/collections — create collection
collectionsRoutes.post("/", async (c) => {
  try {
    const userId = c.get("userId");
    const { title, description, isPublic } = await c.req.json();

    if (!title?.trim()) {
      return c.json({ error: "Collection title is required" }, 400);
    }

    const newCollection = await db
      .insert(collections)
      .values({
        userId,
        title: title.trim(),
        description: description?.trim() ?? null,
        isPublic: isPublic ?? false,
      })
      .returning();

    const created = newCollection[0];
    if (!created) return c.json({ error: "Failed to create collection" }, 500);

    return c.json({ collection: created });
  } catch (error) {
    console.error("Create collection error:", error);
    return c.json({ error: "Failed to create collection" }, 500);
  }
});

// PUT /api/collections/:id — update collection
collectionsRoutes.put("/:id", async (c) => {
  try {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const { title, description, isPublic } = await c.req.json();

    // verify ownership
    const existing = await db
      .select()
      .from(collections)
      .where(and(eq(collections.id, id), eq(collections.userId, userId)))
      .limit(1);

    if (existing.length === 0) {
      return c.json({ error: "Collection not found" }, 404);
    }

    const updates: Record<string, any> = {};
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description?.trim() ?? null;
    if (isPublic !== undefined) updates.isPublic = isPublic;

    const updated = await db
      .update(collections)
      .set(updates)
      .where(eq(collections.id, id))
      .returning();

    return c.json({ collection: updated[0] });
  } catch (error) {
    console.error("Update collection error:", error);
    return c.json({ error: "Failed to update collection" }, 500);
  }
});

// DELETE /api/collections/:id — delete collection
collectionsRoutes.delete("/:id", async (c) => {
  try {
    const userId = c.get("userId");
    const id = c.req.param("id");

    const existing = await db
      .select()
      .from(collections)
      .where(and(eq(collections.id, id), eq(collections.userId, userId)))
      .limit(1);

    if (existing.length === 0) {
      return c.json({ error: "Collection not found" }, 404);
    }

    // delete wallpapers in collection first (cascade)
    await db
      .delete(collectionWallpapers)
      .where(eq(collectionWallpapers.collectionId, id));

    await db.delete(collections).where(eq(collections.id, id));

    return c.json({ message: "Collection deleted successfully" });
  } catch (error) {
    console.error("Delete collection error:", error);
    return c.json({ error: "Failed to delete collection" }, 500);
  }
});

// POST /api/collections/:id/wallpapers — add wallpaper
collectionsRoutes.post("/:id/wallpapers", async (c) => {
  try {
    const userId = c.get("userId");
    const collectionId = c.req.param("id");
    const { wallpaperId } = await c.req.json();

    if (!wallpaperId) {
      return c.json({ error: "wallpaperId is required" }, 400);
    }

    // verify ownership
    const collection = await db
      .select()
      .from(collections)
      .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)))
      .limit(1);

    if (collection.length === 0) {
      return c.json({ error: "Collection not found" }, 404);
    }

    // check if already in collection
    const existing = await db
      .select()
      .from(collectionWallpapers)
      .where(
        and(
          eq(collectionWallpapers.collectionId, collectionId),
          eq(collectionWallpapers.wallpaperId, wallpaperId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return c.json({ error: "Wallpaper already in collection" }, 409);
    }

    await db.insert(collectionWallpapers).values({
      collectionId,
      wallpaperId,
    });

    // set as cover if first wallpaper
    if (!collection[0]?.coverWallpaperId) {
      await db
        .update(collections)
        .set({ coverWallpaperId: wallpaperId })
        .where(eq(collections.id, collectionId));
    }

    return c.json({ message: "Wallpaper added to collection" });
  } catch (error) {
    console.error("Add to collection error:", error);
    return c.json({ error: "Failed to add wallpaper to collection" }, 500);
  }
});

// DELETE /api/collections/:id/wallpapers/:wallpaperId — remove wallpaper
collectionsRoutes.delete("/:id/wallpapers/:wallpaperId", async (c) => {
  try {
    const userId = c.get("userId");
    const collectionId = c.req.param("id");
    const wallpaperId = c.req.param("wallpaperId");

    // verify ownership
    const collection = await db
      .select()
      .from(collections)
      .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)))
      .limit(1);

    if (collection.length === 0) {
      return c.json({ error: "Collection not found" }, 404);
    }

    await db
      .delete(collectionWallpapers)
      .where(
        and(
          eq(collectionWallpapers.collectionId, collectionId),
          eq(collectionWallpapers.wallpaperId, wallpaperId)
        )
      );

    // if removed wallpaper was the cover, update cover to next wallpaper
    if (collection[0]?.coverWallpaperId === wallpaperId) {
      const nextWallpaper = await db
        .select()
        .from(collectionWallpapers)
        .where(eq(collectionWallpapers.collectionId, collectionId))
        .orderBy(desc(collectionWallpapers.addedAt))
        .limit(1);

      await db
        .update(collections)
        .set({
          coverWallpaperId: nextWallpaper[0]?.wallpaperId ?? null,
        })
        .where(eq(collections.id, collectionId));
    }

    return c.json({ message: "Wallpaper removed from collection" });
  } catch (error) {
    console.error("Remove from collection error:", error);
    return c.json({ error: "Failed to remove wallpaper from collection" }, 500);
  }
});

// GET /api/collections/check/:wallpaperId — which collections contain this wallpaper
collectionsRoutes.get("/check/:wallpaperId", async (c) => {
  try {
    const userId = c.get("userId");
    const wallpaperId = c.req.param("wallpaperId");

    const userCollections = await db
      .select({
        id: collections.id,
        title: collections.title,
        isPublic: collections.isPublic,
        hasWallpaper: sql<boolean>`
          exists(
            select 1 from ${collectionWallpapers}
            where ${collectionWallpapers.collectionId} = ${collections.id}
            and ${collectionWallpapers.wallpaperId} = ${wallpaperId}
          )
        `,
      })
      .from(collections)
      .where(eq(collections.userId, userId))
      .orderBy(desc(collections.createdAt));

    return c.json({ data: userCollections });
  } catch (error) {
    console.error("Check collections error:", error);
    return c.json({ error: "Failed to check collections" }, 500);
  }
});