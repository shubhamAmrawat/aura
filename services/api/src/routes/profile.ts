import { Hono } from "hono";
import { db } from "@aura/db";
import { users } from "@aura/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { generateUploadUrl, deleteFile } from "../lib/r2";
import { generateOTP, getOTPExpiry, isOTPExpired } from "../lib/otp";
import { sendOTPEmail } from "../lib/email";
import { otps } from "@aura/db";
import { and } from "drizzle-orm";
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

  const { fileType } = await c.req.json();

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(fileType)) {
    return c.json({ error: "Only JPEG, PNG and WebP images are allowed." }, 400);
  }

  const { uploadUrl, fileUrl, key } = await generateUploadUrl("avatars", fileType);

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

  const { fileUrl } = await c.req.json();

  // delete old avatar from R2 if exists
  if (user.avatarUrl) {
    try {
      const oldKey = user.avatarUrl.replace(`${process.env.R2_PUBLIC_URL}/`, "");
      await deleteFile(oldKey);
    } catch {}
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
      const key = user.avatarUrl.replace(`${process.env.R2_PUBLIC_URL}/`, "");
      await deleteFile(key);
    } catch {}
  }

  await db.delete(users).where(eq(users.id, user.id));

  return c.json({ message: "Account deleted successfully." });
});
