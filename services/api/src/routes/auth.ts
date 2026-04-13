import { Hono } from "hono";
import { db } from "@aura/db";
import { users, otps } from "@aura/db";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { generateOTP, getOTPExpiry, isOTPExpired } from "../lib/otp";
import { generateToken, verifyToken } from "../lib/jwt";
import { sendOTPEmail } from "../lib/email";

export const authRoutes = new Hono();

// ─── SEND OTP ──────────────────────────────────────────────
authRoutes.post("/send-otp", async (c) => {
  try {
    const { email, type } = await c.req.json();

    if (!email || !type) {
      return c.json({ error: "Email and type are required" }, 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return c.json({ error: "Invalid email format" }, 400);
    }

    // check if email exists based on type
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (type === "signup" && existingUser.length > 0) {
      return c.json({ error: "Email already registered. Please login." }, 409);
    }

    if (type === "login" && existingUser.length === 0) {
      return c.json({ error: "No account found. Please signup." }, 404);
    }

    // generate OTP
    const otp = generateOTP();
    const expiresAt = getOTPExpiry();

    // invalidate any existing OTPs for this email+type
    await db
      .delete(otps)
      .where(and(eq(otps.email, email), eq(otps.type, type)));

    // store new OTP
    await db.insert(otps).values({
      email,
      code: otp,
      type,
      expiresAt,
    });

    // send email
    await sendOTPEmail(email, otp, type);

    return c.json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("Send OTP error:", error);
    return c.json({ error: "Failed to send OTP" }, 500);
  }
});

// ─── VERIFY OTP ────────────────────────────────────────────
authRoutes.post("/verify-otp", async (c) => {
  try {
    const { email, code, type } = await c.req.json();

    if (!email || !code || !type) {
      return c.json({ error: "Email, code and type are required" }, 400);
    }

    // find OTP
    const otpRecord = await db
      .select()
      .from(otps)
      .where(
        and(
          eq(otps.email, email),
          eq(otps.type, type),
          eq(otps.verified, false)
        )
      )
      .limit(1);

    if (otpRecord.length === 0) {
      return c.json({ error: "Invalid OTP. Please request a new one." }, 400);
    }

    const otp = otpRecord[0];

    if (!otp) {
      return c.json({ error: "Invalid OTP. Please request a new one." }, 400);
    }
    // check attempts
    if (otp.attempts >= 3) {
      return c.json({ error: "Too many attempts. Please request a new OTP." }, 429);
    }

    // check expiry
    if (isOTPExpired(otp.expiresAt)) {
      return c.json({ error: "OTP expired. Please request a new one." }, 400);
    }

    // check code
    if (otp.code !== code) {
      // increment attempts
      await db
        .update(otps)
        .set({ attempts: otp.attempts + 1 })
        .where(eq(otps.id, otp.id));

      const remaining = 2 - otp.attempts;
      return c.json({
        error: `Incorrect OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
      }, 400);
    }

    // mark as verified
    await db
      .update(otps)
      .set({ verified: true })
      .where(eq(otps.id, otp.id));

    return c.json({ message: "OTP verified successfully", verified: true });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return c.json({ error: "Failed to verify OTP" }, 500);
  }
});

// ─── SIGNUP ────────────────────────────────────────────────
authRoutes.post("/signup", async (c) => {
  try {
    const { email, username, displayName, password } = await c.req.json();

    if (!email || !username || !displayName || !password) {
      return c.json({ error: "All fields are required" }, 400);
    }

    if (password.length < 8) {
      return c.json({ error: "Password must be at least 8 characters" }, 400);
    }

    // verify OTP was completed for this email
    const verifiedOtp = await db
      .select()
      .from(otps)
      .where(
        and(
          eq(otps.email, email),
          eq(otps.type, "signup"),
          eq(otps.verified, true)
        )
      )
      .limit(1);

    if (verifiedOtp.length === 0) {
      return c.json({ error: "Email not verified. Please complete OTP first." }, 400);
    }

    // check username uniqueness
    const existingUsername = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (existingUsername.length > 0) {
      return c.json({ error: "Username already taken." }, 409);
    }

    // hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // create user
    const newUser = await db
      .insert(users)
      .values({
        email,
        username,
        displayName,
        passwordHash,
        isEmailVerified: true,
      })
      .returning();

    const createdUser = newUser[0];

    if (!createdUser) {
      return c.json({ error: "Failed to create user" }, 500);
    }
    // generate JWT
    const token = generateToken({
      userId: createdUser.id,
      email: createdUser.email,
    });
    const isProduction = process.env.NODE_ENV === "production";
    const cookieOptions = isProduction
      ? `HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax; Domain=.aurora-walls.com; Secure`
      : `HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax`;

    c.header("Set-Cookie", `aura_token=${token}; ${cookieOptions}`);

    // clean up used OTP
    await db
      .delete(otps)
      .where(and(eq(otps.email, email), eq(otps.type, "signup")));

    return c.json({
      message: "Account created successfully",
      user: {
        id: createdUser.id,
        email: createdUser.email,
        username: createdUser.username,
        displayName: createdUser.displayName,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    return c.json({ error: "Failed to create account" }, 500);
  }
});

// ─── LOGIN ─────────────────────────────────────────────────
authRoutes.post("/login", async (c) => {
  try {
    const { email } = await c.req.json();

    // verify OTP was completed
    const verifiedOtp = await db
      .select()
      .from(otps)
      .where(
        and(
          eq(otps.email, email),
          eq(otps.type, "login"),
          eq(otps.verified, true)
        )
      )
      .limit(1);

    if (verifiedOtp.length === 0) {
      return c.json({ error: "Email not verified. Please complete OTP first." }, 400);
    }

    const userRecord = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (userRecord.length === 0) {
      return c.json({ error: "User not found" }, 404);
    }

    const u = userRecord[0];

    if (!u) {
      return c.json({ error: "User not found" }, 404);
    }

    const token = generateToken({
      userId: u.id,
      email: u.email,
    });


    const isProduction = process.env.NODE_ENV === "production";
    const cookieOptions = isProduction
      ? `HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax; Domain=.aurora-walls.com; Secure`
      : `HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax`;

    c.header("Set-Cookie", `aura_token=${token}; ${cookieOptions}`);
    await db
      .delete(otps)
      .where(and(eq(otps.email, email), eq(otps.type, "login")));

    return c.json({
      message: "Logged in successfully",
      user: {
        id: u.id,
        email: u.email,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return c.json({ error: "Failed to login" }, 500);
  }
});

// ─── GET CURRENT USER ──────────────────────────────────────
authRoutes.get("/me", async (c) => {
  try {
    // try cookie first, fall back to Authorization header for local dev
    const cookieHeader = c.req.header("Cookie") ?? "";
    const cookieToken = cookieHeader
      .split(";")
      .map(s => s.trim())
      .find(s => s.startsWith("aura_token="))
      ?.split("=")[1];

    const authHeader = c.req.header("Authorization");
    const headerToken = authHeader?.replace("Bearer ", "");

    const token = cookieToken || headerToken;


    if (!token) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const payload = verifyToken(token);

    const userRecord = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    const u = userRecord[0];
    if (!u) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json({
      user: {
        id: u.id,
        email: u.email,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        coverUrl: u.coverUrl,
        bio: u.bio,
        isCreator: u.isCreator,
        isPro: u.isPro,
        totalDownloads: u.totalDownloads,
        totalUploads: u.totalUploads,
        createdAt: u.createdAt,
      },
    });
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }
});

authRoutes.post("/logout", async (c) => {
  const isProduction = process.env.NODE_ENV === "production";
  const domain = isProduction ? "; Domain=.aurora-walls.com" : "";
  c.header("Set-Cookie", `aura_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${domain}`);
  return c.json({ message: "Logged out successfully" });
});


// PUT /api/auth/become-creator
authRoutes.put("/become-creator", async (c) => {
  try {
    const cookieHeader = c.req.header("Cookie") ?? "";
    const cookieToken = cookieHeader
      .split(";")
      .map(s => s.trim())
      .find(s => s.startsWith("aura_token="))
      ?.split("=")[1];

    const authHeader = c.req.header("Authorization");
    const headerToken = authHeader?.replace("Bearer ", "");
    const token = cookieToken || headerToken;

    if (!token) return c.json({ error: "Unauthorized" }, 401);

    const payload = verifyToken(token);

    await db
      .update(users)
      .set({ isCreator: true })
      .where(eq(users.id, payload.userId));

    const updated = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    const u = updated[0];
    if (!u) return c.json({ error: "User not found" }, 404);

    return c.json({
      message: "You are now a creator!",
      user: {
        id: u.id,
        email: u.email,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        coverUrl: u.coverUrl,
        isCreator: u.isCreator,
        isPro: u.isPro,
      },
    });
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }
});