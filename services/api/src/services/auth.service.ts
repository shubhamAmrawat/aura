import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { db } from "../config/db";
import { otps, users } from "../models";
import { ApiError } from "../utils/ApiError";
import { generateOTP, getOTPExpiry, isOTPExpired } from "../utils/otp";
import { generateToken } from "../utils/jwt";
import { sendOTPEmail } from "../integrations/email";
import type { OtpType } from "../validators/auth.schema";

async function findUserByEmail(email: string) {
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0];
}

export async function findUserById(id: string) {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0];
}

/** Replace any pending OTP for email+type with a new one and email it. */
export async function issueOtp(email: string, type: string) {
  const otp = generateOTP();
  const expiresAt = getOTPExpiry();

  await db.delete(otps).where(and(eq(otps.email, email), eq(otps.type, type)));
  await db.insert(otps).values({ email, code: otp, type, expiresAt });
  await sendOTPEmail(email, otp, type as OtpType);
}

export async function sendOtp(email: string, type: string) {
  const existing = await findUserByEmail(email);
  if (type === "signup" && existing) {
    throw new ApiError(409, "Email already registered. Please login.");
  }
  if (type === "login" && !existing) {
    throw new ApiError(404, "No account found. Please signup.");
  }
  await issueOtp(email, type);
}

/**
 * Check a code against the newest unverified OTP; wrong codes count attempts.
 * `wrongCodeMessage` lets callers keep their own wording.
 */
export async function checkOtp(
  email: string,
  type: string,
  code: unknown,
  wrongCodeMessage: (attemptsSoFar: number) => string
) {
  const [otp] = await db
    .select()
    .from(otps)
    .where(and(eq(otps.email, email), eq(otps.type, type), eq(otps.verified, false)))
    .limit(1);

  if (!otp) throw new ApiError(400, "Invalid OTP. Please request a new one.");
  if (otp.attempts >= 3) throw new ApiError(429, "Too many attempts. Please request a new OTP.");
  if (isOTPExpired(otp.expiresAt)) throw new ApiError(400, "OTP expired. Please request a new one.");

  if (otp.code !== code) {
    await db.update(otps).set({ attempts: otp.attempts + 1 }).where(eq(otps.id, otp.id));
    throw new ApiError(400, wrongCodeMessage(otp.attempts));
  }

  await db.update(otps).set({ verified: true }).where(eq(otps.id, otp.id));
}

export async function verifyOtp(email: string, code: unknown, type: string) {
  await checkOtp(email, type, code, (attempts) => {
    const remaining = 2 - attempts;
    return `Incorrect OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`;
  });
}

async function hasVerifiedOtp(email: string, type: string) {
  const rows = await db
    .select()
    .from(otps)
    .where(and(eq(otps.email, email), eq(otps.type, type), eq(otps.verified, true)))
    .limit(1);
  return rows.length > 0;
}

export async function signup(input: { email: string; username: string; displayName: string; password: string }) {
  if (!(await hasVerifiedOtp(input.email, "signup"))) {
    throw new ApiError(400, "Email not verified. Please complete OTP first.");
  }

  const taken = await db.select().from(users).where(eq(users.username, input.username)).limit(1);
  if (taken.length > 0) throw new ApiError(409, "Username already taken.");

  const passwordHash = await bcrypt.hash(input.password, 12);
  const [created] = await db
    .insert(users)
    .values({
      email: input.email,
      username: input.username,
      displayName: input.displayName,
      passwordHash,
      isEmailVerified: true,
    })
    .returning();
  if (!created) throw new ApiError(500, "Failed to create user");

  const token = generateToken({ userId: created.id, email: created.email });
  return { user: created, token };
}

/** Delete OTPs once they've been consumed. */
export async function clearOtps(email: string, type: string) {
  await db.delete(otps).where(and(eq(otps.email, email), eq(otps.type, type)));
}

export async function login(email: string) {
  if (!(await hasVerifiedOtp(email, "login"))) {
    throw new ApiError(400, "Email not verified. Please complete OTP first.");
  }
  const user = await findUserByEmail(email);
  if (!user) throw new ApiError(404, "User not found");

  const token = generateToken({ userId: user.id, email: user.email });
  return { user, token };
}

export async function becomeCreator(userId: string) {
  await db.update(users).set({ isCreator: true }).where(eq(users.id, userId));
  return findUserById(userId);
}
