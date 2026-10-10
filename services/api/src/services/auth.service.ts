import bcrypt from "bcryptjs";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "../config/db";
import { otps, users } from "../models";
import { ApiError } from "../utils/ApiError";
import { generateOTP, getOTPExpiry, isOTPExpired } from "../utils/otp";
import { generateToken } from "../utils/jwt";
import { sendOTPEmail } from "../integrations/email";
import { googleAudiences, verifyGoogleIdToken } from "../integrations/google";
import { importGoogleAvatar, isGoogleAvatarUrl } from "../integrations/avatarImport";
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

  const token = generateToken({ userId: created.id, email: created.email, role: created.role });
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

  const token = generateToken({ userId: user.id, email: user.email, role: user.role });
  return { user, token };
}

export async function becomeCreator(userId: string) {
  await db.update(users).set({ isCreator: true }).where(eq(users.id, userId));
  return findUserById(userId);
}

// ─── Password login (with per-account lockout) ─────────────

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const INVALID_LOGIN = "Invalid email or password.";
// Real bcrypt hash (cost 12) of a random string, created once: compared against when the
// account doesn't exist, so "unknown email" and "wrong password" take the same time.
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= bcrypt.hash(crypto.randomUUID(), 12));

/** Case-insensitive email lookup (emails are stored as typed at signup). */
export async function findUserByEmailCI(email: string) {
  const rows = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email.trim()})`)
    .limit(1);
  return rows[0];
}

function lockedMessage(until: Date) {
  const minutes = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60_000));
  return `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}, or sign in with a code.`;
}

export async function loginWithPassword(email: string, password: string) {
  const user = await findUserByEmailCI(email);

  if (!user || !user.passwordHash) {
    await bcrypt.compare(password, await getDummyHash());
    throw new ApiError(401, INVALID_LOGIN);
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new ApiError(429, lockedMessage(user.lockedUntil));
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const attempts = user.failedLoginAttempts + 1;
    if (attempts >= MAX_FAILED_LOGINS) {
      const until = new Date(Date.now() + LOCK_MINUTES * 60_000);
      await db.update(users).set({ failedLoginAttempts: 0, lockedUntil: until }).where(eq(users.id, user.id));
      throw new ApiError(429, lockedMessage(until));
    }
    await db.update(users).set({ failedLoginAttempts: attempts }).where(eq(users.id, user.id));
    throw new ApiError(401, INVALID_LOGIN);
  }

  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await db.update(users).set({ failedLoginAttempts: 0, lockedUntil: null }).where(eq(users.id, user.id));
  }
  const token = generateToken({ userId: user.id, email: user.email, role: user.role });
  return { user, token };
}

// ─── Google sign-in ────────────────────────────────────────

/** "Shubham.Amrawat+x@gmail.com" → "shubhamamrawatx"; unique, 3–20 chars. */
async function uniqueUsernameFrom(email: string): Promise<string> {
  let base = email.split("@")[0]!.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
  if (base.length < 3) base = `user${base}`;
  const candidates = [base, ...Array.from({ length: 6 }, () => `${base.slice(0, 15)}_${Math.floor(1000 + Math.random() * 9000)}`)];
  for (const candidate of candidates) {
    const taken = await db.select({ id: users.id }).from(users).where(eq(users.username, candidate)).limit(1);
    if (taken.length === 0) return candidate;
  }
  return `user_${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Sign in with a Google ID token. Order: existing google_id → existing email (link) → new account.
 * Returns isNewUser so the client can show a welcome step.
 */
export async function loginWithGoogle(credential: string) {
  if (googleAudiences().length === 0) throw new ApiError(503, "Google sign-in is not configured.");

  let profile;
  try {
    profile = await verifyGoogleIdToken(credential);
  } catch {
    throw new ApiError(401, "Google sign-in failed.");
  }
  if (!profile.emailVerified) throw new ApiError(401, "Your Google email address isn't verified.");

  type User = typeof users.$inferSelect;

  // Store our own copy of the Google photo (also migrates old hot-linked ones).
  const withOwnAvatar = async (user: User): Promise<User> => {
    if (!isGoogleAvatarUrl(user.avatarUrl)) return user;
    try {
      const ownUrl = await importGoogleAvatar(user.avatarUrl, user.id);
      if (!ownUrl) return user;
      const [updated] = await db
        .update(users)
        .set({ avatarUrl: ownUrl, updatedAt: new Date() })
        .where(eq(users.id, user.id))
        .returning();
      return updated ?? user;
    } catch (err) {
      console.error("[avatar] Saving imported avatar failed:", err);
      return user;
    }
  };

  const issue = async (user: User, isNewUser: boolean) => {
    const finalUser = await withOwnAvatar(user);
    return {
      user: finalUser,
      isNewUser,
      token: generateToken({ userId: finalUser.id, email: finalUser.email, role: finalUser.role }),
    };
  };

  // 1. Already linked
  const [linked] = await db.select().from(users).where(eq(users.googleId, profile.sub)).limit(1);
  if (linked) return issue(linked, false);

  // 2. Existing account with the same email → link it
  const existing = await findUserByEmailCI(profile.email);
  if (existing) {
    if (existing.googleId && existing.googleId !== profile.sub) {
      throw new ApiError(409, "This email is already linked to a different Google account.");
    }
    const [updated] = await db
      .update(users)
      .set({
        googleId: profile.sub,
        isEmailVerified: true,
        avatarUrl: existing.avatarUrl ?? profile.picture,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id))
      .returning();
    return issue(updated!, false);
  }

  // 3. New account
  const username = await uniqueUsernameFrom(profile.email);
  try {
    const [created] = await db
      .insert(users)
      .values({
        email: profile.email,
        username,
        displayName: profile.name?.trim() || username,
        avatarUrl: profile.picture,
        googleId: profile.sub,
        isEmailVerified: true,
        passwordHash: null,
      })
      .returning();
    return issue(created!, true);
  } catch (err) {
    // Lost a race with a parallel request for the same Google account → just log in.
    const [again] = await db.select().from(users).where(eq(users.googleId, profile.sub)).limit(1);
    if (again) return issue(again, false);
    throw err;
  }
}

// ─── Forgot / reset password ───────────────────────────────

const RESEND_COOLDOWN_SECONDS = 60;

/** Always resolves (never reveals whether the email has an account). */
export async function forgotPassword(email: string) {
  const user = await findUserByEmailCI(email);
  if (!user) return;

  // Don't email a new code more than once a minute.
  const recent = await db
    .select({ id: otps.id })
    .from(otps)
    .where(
      and(
        eq(otps.email, user.email),
        eq(otps.type, "password_reset"),
        gt(otps.createdAt, sql`NOW() - make_interval(secs => ${RESEND_COOLDOWN_SECONDS})`)
      )
    )
    .limit(1);
  if (recent.length > 0) return;

  await issueOtp(user.email, "password_reset");
}

const remainingAttemptsMessage = (attempts: number) => {
  const remaining = 2 - attempts;
  return `Incorrect OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`;
};

/** Step 2 of the reset flow: check the emailed code and mark it verified. */
export async function verifyResetCode(email: string, otp: unknown) {
  const user = await findUserByEmailCI(email);
  if (!user) throw new ApiError(400, "Invalid OTP. Please request a new one.");
  await checkOtp(user.email, "password_reset", otp, remainingAttemptsMessage);
}

/**
 * Set a new password; also clears any lockout. Either pass the emailed code
 * (one-shot), or omit it after verifyResetCode (must be within the code's expiry).
 */
export async function resetPassword(email: string, otp: unknown, newPassword: string) {
  const user = await findUserByEmailCI(email);
  if (!user) throw new ApiError(400, "Invalid OTP. Please request a new one.");

  if (otp !== null && otp !== undefined && otp !== "") {
    await checkOtp(user.email, "password_reset", otp, () => "Incorrect OTP.");
  } else {
    const [verified] = await db
      .select({ id: otps.id })
      .from(otps)
      .where(
        and(
          eq(otps.email, user.email),
          eq(otps.type, "password_reset"),
          eq(otps.verified, true),
          gt(otps.expiresAt, new Date())
        )
      )
      .limit(1);
    if (!verified) throw new ApiError(400, "Your code has expired. Please request a new one.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db
    .update(users)
    .set({ passwordHash, failedLoginAttempts: 0, lockedUntil: null, updatedAt: new Date() })
    .where(eq(users.id, user.id));
  await clearOtps(user.email, "password_reset");
}
