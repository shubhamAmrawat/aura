import { Hono } from "hono";
import { db } from "@aura/db";
import { users, wallpapers } from "@aura/db";
import { eq, and, desc, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { generateUploadUrl, deleteFile, buildObjectKey, uploadFileToKey } from "../lib/r2";
import { generateOTP, getOTPExpiry, isOTPExpired } from "../lib/otp";
import { sendOTPEmail } from "../lib/email";
import { otps } from "@aura/db";
import { authMiddleware } from "../middleware/auth";

type Variables = {
  userId: string;
  email: string;
};

export const profileRoutes = new Hono<{ Variables: Variables }>();

profileRoutes.use("*", authMiddleware);

// ─── GET PROFILE ───────────────────────────────────────────
profileRoutes.get("/", async (c) => {
  const userId = c.get("userId");

  const userRecord = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = userRecord[0];
  if (!user) return c.json({ error: "User not found" }, 404);

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      coverUrl: user.coverUrl,
      bio: user.bio,
      contactNo: user.contactNo,
      isCreator: user.isCreator,
      isPro: user.isPro,
      totalDownloads: user.totalDownloads,
      totalUploads: user.totalUploads,
      usernameChangedAt: user.usernameChangedAt,
      createdAt: user.createdAt,
    },
  });
});

// ─── UPDATE PROFILE ────────────────────────────────────────
profileRoutes.put("/", async (c) => {
  const userId = c.get("userId");

  const userRecord = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = userRecord[0];
  if (!user) return c.json({ error: "User not found" }, 404);

  const { displayName, bio, contactNo, username } = await c.req.json();

  const updates: Record<string, any> = {
    updatedAt: new Date(),
  };

  if (displayName !== undefined) updates.displayName = displayName;
  if (bio !== undefined) updates.bio = bio;
  if (contactNo !== undefined) updates.contactNo = contactNo;

  if (username !== undefined && username !== user.username) {
    // check 2 week cooldown
    if (user.usernameChangedAt) {
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      if (user.usernameChangedAt > twoWeeksAgo) {
        const nextChange = new Date(user.usernameChangedAt);
        nextChange.setDate(nextChange.getDate() + 14);
        return c.json({
          error: `Username can only be changed once every 2 weeks. Next change available on ${nextChange.toDateString()}.`
        }, 429);
      }
    }

    // check uniqueness
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (existing.length > 0) {
      return c.json({ error: "Username already taken." }, 409);
    }

    updates.username = username;
    updates.usernameChangedAt = new Date();
  }

  const updated = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, user.id))
    .returning();

  const u = updated[0];
  if (!u) return c.json({ error: "Failed to update profile" }, 500);

  return c.json({
    message: "Profile updated successfully",
    user: {
      id: u.id,
      email: u.email,
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      bio: u.bio,
      contactNo: u.contactNo,
      usernameChangedAt: u.usernameChangedAt,
    },
  });
});

// ─── GET AVATAR UPLOAD URL ─────────────────────────────────
profileRoutes.post("/avatar/upload-url", async (c) => {
  const userId = c.get("userId");

  const { fileType } = await c.req.json();

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(fileType)) {
    return c.json({ error: "Only JPEG, PNG and WebP images are allowed." }, 400);
  }

  const { uploadUrl, fileUrl, key } = await generateUploadUrl("avatars", fileType, userId);

  return c.json({ uploadUrl, fileUrl, key });
});

// ─── CONFIRM AVATAR UPLOAD ─────────────────────────────────
profileRoutes.put("/avatar", async (c) => {
  const userId = c.get("userId");

  const userRecord = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = userRecord[0];
  if (!user) return c.json({ error: "User not found" }, 404);

  const { fileUrl, key } = await c.req.json();
  const publicBaseUrl = process.env.R2_PUBLIC_URL;

  if (!fileUrl || !key) {
    return c.json({ error: "fileUrl and key are required." }, 400);
  }
  if (!publicBaseUrl) {
    return c.json({ error: "Avatar storage is not configured." }, 500);
  }

  if (!key.startsWith(`avatars/${userId}/`)) {
    return c.json({ error: "Invalid avatar key." }, 400);
  }

  const expectedFileUrl = `${publicBaseUrl}/${key}`;
  if (fileUrl !== expectedFileUrl) {
    return c.json({ error: "Invalid avatar URL." }, 400);
  }

  // delete old avatar from R2 if exists
  if (user.avatarUrl) {
    try {
      const oldPrefix = `${publicBaseUrl}/`;
      if (user.avatarUrl.startsWith(oldPrefix)) {
        const oldKey = user.avatarUrl.slice(oldPrefix.length);
        if (oldKey.startsWith(`avatars/${userId}/`)) {
          await deleteFile(oldKey);
        }
      }
    } catch (error) {
      console.error("Failed to cleanup previous avatar", error);
    }
  }

  await db
    .update(users)
    .set({ avatarUrl: fileUrl, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return c.json({ message: "Avatar updated successfully", avatarUrl: fileUrl });
});

// ─── GET COVER UPLOAD URL ──────────────────────────────────
profileRoutes.post("/cover/upload-url", async (c) => {
  const userId = c.get("userId");

  const { fileType } = await c.req.json();

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(fileType)) {
    return c.json({ error: "Only JPEG, PNG and WebP images are allowed." }, 400);
  }

  const { uploadUrl, fileUrl, key } = await generateUploadUrl("covers", fileType, userId);

  return c.json({ uploadUrl, fileUrl, key });
});

// ─── CONFIRM COVER UPLOAD ──────────────────────────────────
profileRoutes.put("/cover", async (c) => {
  const userId = c.get("userId");

  const userRecord = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = userRecord[0];
  if (!user) return c.json({ error: "User not found" }, 404);

  const { fileUrl, key } = await c.req.json();
  const publicBaseUrl = process.env.R2_PUBLIC_URL;

  if (!fileUrl || !key) return c.json({ error: "fileUrl and key are required." }, 400);
  if (!publicBaseUrl) return c.json({ error: "Cover storage is not configured." }, 500);

  if (!key.startsWith(`covers/${userId}/`)) {
    return c.json({ error: "Invalid cover key." }, 400);
  }
  if (fileUrl !== `${publicBaseUrl}/${key}`) {
    return c.json({ error: "Invalid cover URL." }, 400);
  }

  if (user.coverUrl) {
    try {
      const prefix = `${publicBaseUrl}/`;
      if (user.coverUrl.startsWith(prefix)) {
        const oldKey = user.coverUrl.slice(prefix.length);
        if (oldKey.startsWith(`covers/${userId}/`)) await deleteFile(oldKey);
      }
    } catch (error) {
      console.error("Failed to cleanup previous cover", error);
    }
  }

  await db
    .update(users)
    .set({ coverUrl: fileUrl, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return c.json({ message: "Cover updated successfully", coverUrl: fileUrl });
});

// ─── DIRECT COVER UPLOAD (fallback for CORS/signed-url issues) ───────────────
profileRoutes.post("/cover/direct", async (c) => {
  const userId = c.get("userId");
  const publicBaseUrl = process.env.R2_PUBLIC_URL;
  if (!publicBaseUrl) return c.json({ error: "Cover storage is not configured." }, 500);

  const userRecord = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = userRecord[0];
  if (!user) return c.json({ error: "User not found" }, 404);

  const formData = await c.req.formData();
  const file = formData.get("cover");
  if (!(file instanceof File)) return c.json({ error: "Cover file is required." }, 400);

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return c.json({ error: "Only JPEG, PNG and WebP images are allowed." }, 400);
  }
  if (file.size > 10 * 1024 * 1024) {
    return c.json({ error: "Cover must be smaller than 10MB." }, 400);
  }

  const key = buildObjectKey("covers", file.type, userId);
  const bytes = await file.arrayBuffer();
  const fileUrl = await uploadFileToKey(key, Buffer.from(bytes), file.type);

  await db
    .update(users)
    .set({ coverUrl: fileUrl, updatedAt: new Date() })
    .where(eq(users.id, userId));

  if (user.coverUrl) {
    try {
      const prefix = `${publicBaseUrl}/`;
      if (user.coverUrl.startsWith(prefix)) {
        const oldKey = user.coverUrl.slice(prefix.length);
        if (oldKey.startsWith(`covers/${userId}/`)) await deleteFile(oldKey);
      }
    } catch (error) {
      console.error("Failed to cleanup previous cover", error);
    }
  }

  return c.json({ message: "Cover updated successfully", coverUrl: fileUrl });
});

// ─── DIRECT AVATAR UPLOAD (fallback for CORS/signed-url issues) ─────────────
profileRoutes.post("/avatar/direct", async (c) => {
  const userId = c.get("userId");
  const publicBaseUrl = process.env.R2_PUBLIC_URL;
  if (!publicBaseUrl) {
    return c.json({ error: "Avatar storage is not configured." }, 500);
  }

  const userRecord = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = userRecord[0];
  if (!user) return c.json({ error: "User not found" }, 404);

  const formData = await c.req.formData();
  const file = formData.get("avatar");

  if (!(file instanceof File)) {
    return c.json({ error: "Avatar file is required." }, 400);
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return c.json({ error: "Only JPEG, PNG and WebP images are allowed." }, 400);
  }
  if (file.size > 5 * 1024 * 1024) {
    return c.json({ error: "Avatar must be smaller than 5MB." }, 400);
  }

  const key = buildObjectKey("avatars", file.type, userId);
  const bytes = await file.arrayBuffer();
  const fileUrl = await uploadFileToKey(key, Buffer.from(bytes), file.type);

  if (user.avatarUrl) {
    try {
      const prefix = `${publicBaseUrl}/`;
      if (user.avatarUrl.startsWith(prefix)) {
        const oldKey = user.avatarUrl.slice(prefix.length);
        if (oldKey.startsWith(`avatars/${userId}/`)) {
          await deleteFile(oldKey);
        }
      }
    } catch (error) {
      console.error("Failed to cleanup previous avatar", error);
    }
  }

  await db
    .update(users)
    .set({ avatarUrl: fileUrl, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return c.json({ message: "Avatar updated successfully", avatarUrl: fileUrl });
});

// ─── CHANGE PASSWORD — STEP 1: verify current password ─────
profileRoutes.post("/change-password/verify", async (c) => {
  const userId = c.get("userId");

  const userRecord = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = userRecord[0];
  if (!user) return c.json({ error: "User not found" }, 404);

  const { currentPassword } = await c.req.json();

  if (!user.passwordHash) {
    return c.json({ error: "No password set for this account." }, 400);
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return c.json({ error: "Current password is incorrect." }, 400);
  }

  const otp = generateOTP();
  const expiresAt = getOTPExpiry();

  await db
    .delete(otps)
    .where(and(eq(otps.email, user.email), eq(otps.type, "password_reset")));

  await db.insert(otps).values({
    email: user.email,
    code: otp,
    type: "password_reset",
    expiresAt,
  });

  await sendOTPEmail(user.email, otp, "password_reset");

  return c.json({ message: "OTP sent to your email." });
});

// ─── CHANGE PASSWORD — STEP 2: verify OTP + set new password
profileRoutes.post("/change-password/confirm", async (c) => {
  const userId = c.get("userId");

  const userRecord = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = userRecord[0];
  if (!user) return c.json({ error: "User not found" }, 404);

  const { otp, newPassword } = await c.req.json();

  if (!otp || !newPassword) {
    return c.json({ error: "OTP and new password are required." }, 400);
  }

  if (newPassword.length < 8) {
    return c.json({ error: "Password must be at least 8 characters." }, 400);
  }

  const otpRecord = await db
    .select()
    .from(otps)
    .where(
      and(
        eq(otps.email, user.email),
        eq(otps.type, "password_reset"),
        eq(otps.verified, false)
      )
    )
    .limit(1);

  const otpEntry = otpRecord[0];
  if (!otpEntry) {
    return c.json({ error: "Invalid OTP. Please request a new one." }, 400);
  }

  if (otpEntry.attempts >= 3) {
    return c.json({ error: "Too many attempts. Please request a new OTP." }, 429);
  }

  if (isOTPExpired(otpEntry.expiresAt)) {
    return c.json({ error: "OTP expired. Please request a new one." }, 400);
  }

  if (otpEntry.code !== otp) {
    await db
      .update(otps)
      .set({ attempts: otpEntry.attempts + 1 })
      .where(eq(otps.id, otpEntry.id));
    return c.json({ error: "Incorrect OTP." }, 400);
  }

  await db
    .update(otps)
    .set({ verified: true })
    .where(eq(otps.id, otpEntry.id));

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  await db
    .delete(otps)
    .where(and(eq(otps.email, user.email), eq(otps.type, "password_reset")));

  return c.json({ message: "Password changed successfully." });
});

// ─── DELETE ACCOUNT ────────────────────────────────────────
profileRoutes.delete("/", async (c) => {
  const userId = c.get("userId");

  const userRecord = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = userRecord[0];
  if (!user) return c.json({ error: "User not found" }, 404);

  const { password } = await c.req.json();

  if (!user.passwordHash) {
    return c.json({ error: "No password set for this account." }, 400);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return c.json({ error: "Incorrect password." }, 400);
  }

  if (user.avatarUrl) {
    try {
      const publicBaseUrl = process.env.R2_PUBLIC_URL;
      if (publicBaseUrl) {
        const prefix = `${publicBaseUrl}/`;
        if (user.avatarUrl.startsWith(prefix)) {
          const key = user.avatarUrl.slice(prefix.length);
          if (key.startsWith(`avatars/${userId}/`)) {
            await deleteFile(key);
          }
        }
      }
    } catch (error) {
      console.error("Failed to cleanup avatar on account delete", error);
    }
  }

  await db.delete(users).where(eq(users.id, user.id));

  return c.json({ message: "Account deleted successfully." });
});

// ─── UPLOADS MANAGEMENT ────────────────────────────────────

// GET /api/profile/uploads — paginated list of caller's own wallpapers
profileRoutes.get("/uploads", async (c) => {
  try {
    const userId = c.get("userId");
    const limit = Math.min(Number(c.req.query("limit")) || 24, 50);
    const offset = Math.max(0, Number(c.req.query("offset")) || 0);

    const rows = await db
      .select({
        id: wallpapers.id,
        title: wallpapers.title,
        description: wallpapers.description,
        fileUrl: wallpapers.fileUrl,
        blurhash: wallpapers.blurhash,
        dominantColor: wallpapers.dominantColor,
        width: wallpapers.width,
        height: wallpapers.height,
        tags: wallpapers.tags,
        categoryId: wallpapers.categoryId,
        status: wallpapers.status,
        likeCount: wallpapers.likeCount,
        downloadCount: wallpapers.downloadCount,
        createdAt: wallpapers.createdAt,
        format: wallpapers.format,
      })
      .from(wallpapers)
      .where(eq(wallpapers.uploaderId, userId))
      .orderBy(desc(wallpapers.createdAt))
      .limit(limit + 1)
      .offset(offset);

    const hasMore = rows.length > limit;
    return c.json({ data: hasMore ? rows.slice(0, limit) : rows, hasMore });
  } catch (err) {
    console.error("Get uploads error:", err);
    return c.json({ error: "Failed to fetch uploads" }, 500);
  }
});

// PUT /api/profile/uploads/:id — edit wallpaper metadata (title, description, tags, category)
profileRoutes.put("/uploads/:id", async (c) => {
  try {
    const userId = c.get("userId");
    const wallpaperId = c.req.param("id");
    const { title, description, tags, categoryId } = await c.req.json();

    if (!title?.trim()) return c.json({ error: "Title is required" }, 400);

    const existing = await db
      .select({ id: wallpapers.id, uploaderId: wallpapers.uploaderId })
      .from(wallpapers)
      .where(eq(wallpapers.id, wallpaperId))
      .limit(1);

    if (!existing[0]) return c.json({ error: "Wallpaper not found" }, 404);
    if (existing[0].uploaderId !== userId) return c.json({ error: "Not authorized" }, 403);

    const updated = await db
      .update(wallpapers)
      .set({
        title: title.trim(),
        description: description?.trim() || null,
        tags: Array.isArray(tags) ? tags.map((t: string) => t.trim()).filter(Boolean) : [],
        categoryId: categoryId || null,
        updatedAt: new Date(),
      })
      .where(eq(wallpapers.id, wallpaperId))
      .returning();

    const row = updated[0];

    // Re-embed with updated metadata in background (no vision re-run needed)
    if (row) {
      setImmediate(() => {
        import("../lib/embeddings")
          .then(({ generateWallpaperTextEmbedding }) =>
            generateWallpaperTextEmbedding({
              title: row.title,
              description: row.description,
              tags: row.tags,
            })
          )
          .then((textEmbedding) => {
            if (!textEmbedding) return;
            return db
              .update(wallpapers)
              .set({ textEmbedding })
              .where(eq(wallpapers.id, row.id));
          })
          .catch((e) => console.error("[embedding] Re-embed on edit failed:", e));
      });
    }

    return c.json({ data: row });
  } catch (err) {
    console.error("Update upload error:", err);
    return c.json({ error: "Failed to update wallpaper" }, 500);
  }
});

// DELETE /api/profile/uploads/:id — delete wallpaper from DB + R2
profileRoutes.delete("/uploads/:id", async (c) => {
  try {
    const userId = c.get("userId");
    const wallpaperId = c.req.param("id");

    const existing = await db
      .select({
        id: wallpapers.id,
        uploaderId: wallpapers.uploaderId,
        fileUrl: wallpapers.fileUrl,
      })
      .from(wallpapers)
      .where(eq(wallpapers.id, wallpaperId))
      .limit(1);

    if (!existing[0]) return c.json({ error: "Wallpaper not found" }, 404);
    if (existing[0].uploaderId !== userId) return c.json({ error: "Not authorized" }, 403);

    // Delete DB row first
    await db.delete(wallpapers).where(eq(wallpapers.id, wallpaperId));

    // Delete from R2 — extract key from public URL
    const r2PublicUrl = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");
    const fileUrl = existing[0].fileUrl;
    if (r2PublicUrl && fileUrl.startsWith(r2PublicUrl)) {
      const key = fileUrl.slice(r2PublicUrl.length + 1);
      await deleteFile(key).catch((e) =>
        console.error("[r2] Delete file failed (non-fatal):", e)
      );
    }

    // Decrement upload count (floor at 0)
    await db
      .update(users)
      .set({ totalUploads: sql`GREATEST(${users.totalUploads} - 1, 0)` })
      .where(eq(users.id, userId));

    return c.json({ message: "Wallpaper deleted" });
  } catch (err) {
    console.error("Delete upload error:", err);
    return c.json({ error: "Failed to delete wallpaper" }, 500);
  }
});
