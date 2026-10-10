import { route } from "../utils/asyncRoute";
import { ApiError } from "../utils/ApiError";
import { parseOrThrow } from "../utils/validate";
import { setAuthCookie, clearAuthCookie } from "../utils/cookies";
import { verifyToken } from "../utils/jwt";
import { getAuthToken } from "../middleware/auth";
import {
  EmailFormat,
  ForgotPasswordBody,
  GoogleLoginBody,
  PasswordLength,
  PasswordLoginBody,
  ResetPasswordBody,
  SendOtpBody,
  SignupBody,
  VerifyOtpBody,
  VerifyResetCodeBody,
} from "../validators/auth.schema";
import * as authService from "../services/auth.service";

export const sendOtp = route("Failed to send OTP", async (req, res) => {
  const { email, type } = parseOrThrow(SendOtpBody, req.body);
  parseOrThrow(EmailFormat, email);
  await authService.sendOtp(email, type);
  res.json({ message: "OTP sent successfully" });
});

export const verifyOtp = route("Failed to verify OTP", async (req, res) => {
  const { email, code, type } = parseOrThrow(VerifyOtpBody, req.body);
  await authService.verifyOtp(email, code, type);
  res.json({ message: "OTP verified successfully", verified: true });
});

export const signup = route("Failed to create account", async (req, res) => {
  const body = parseOrThrow(SignupBody, req.body);
  parseOrThrow(PasswordLength, body.password);

  const { user, token } = await authService.signup(body);
  setAuthCookie(res, token);
  await authService.clearOtps(body.email, "signup");

  res.json({
    message: "Account created successfully",
    token,
    user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName },
  });
});

export const login = route("Failed to login", async (req, res) => {
  const email = req.body?.email;
  const { user, token } = await authService.login(email);
  setAuthCookie(res, token);
  await authService.clearOtps(email, "login");

  res.json({
    message: "Logged in successfully",
    token,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    },
  });
});

/** Resolve the caller from cookie/Bearer; any failure → 401 (same as before). */
function userIdFromToken(req: Parameters<typeof getAuthToken>[0]): string {
  const token = getAuthToken(req);
  if (!token) throw new ApiError(401, "Unauthorized");
  return verifyToken(token).userId;
}

export const me = route(
  "Unauthorized",
  async (req, res) => {
    const user = await authService.findUserById(userIdFromToken(req));
    if (!user) throw new ApiError(404, "User not found");

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        coverUrl: user.coverUrl,
        bio: user.bio,
        isCreator: user.isCreator,
        isPro: user.isPro,
        totalDownloads: user.totalDownloads,
        totalUploads: user.totalUploads,
        createdAt: user.createdAt,
        hasPassword: user.passwordHash !== null,
        googleLinked: user.googleId !== null,
      },
    });
  },
  401
);

export const logout = route("Failed to logout", async (_req, res) => {
  clearAuthCookie(res);
  res.json({ message: "Logged out successfully" });
});

export const becomeCreator = route(
  "Unauthorized",
  async (req, res) => {
    const user = await authService.becomeCreator(userIdFromToken(req));
    if (!user) throw new ApiError(404, "User not found");

    res.json({
      message: "You are now a creator!",
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        coverUrl: user.coverUrl,
        isCreator: user.isCreator,
        isPro: user.isPro,
      },
    });
  },
  401
);

/** Same shape as the OTP /login response. */
function loginResponse(user: { id: string; email: string; username: string; displayName: string; avatarUrl: string | null }, token: string) {
  return {
    message: "Logged in successfully",
    token,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    },
  };
}

/** POST /api/auth/login/password { email, password } */
export const loginWithPassword = route("Failed to login", async (req, res) => {
  const { email, password } = parseOrThrow(PasswordLoginBody, req.body);
  if (typeof email !== "string" || typeof password !== "string") {
    throw new ApiError(401, "Invalid email or password.");
  }
  const { user, token } = await authService.loginWithPassword(email, password);
  setAuthCookie(res, token);
  res.json(loginResponse(user, token));
});

/** POST /api/auth/google { credential } — Google Identity Services ID token */
export const loginWithGoogle = route("Google sign-in failed.", async (req, res) => {
  const { credential } = parseOrThrow(GoogleLoginBody, req.body);
  const { user, token, isNewUser } = await authService.loginWithGoogle(credential);
  setAuthCookie(res, token);
  res.json({ ...loginResponse(user, token), isNewUser });
});

/** POST /api/auth/forgot-password { email } — always the same answer */
export const forgotPassword = route("Failed to send reset code", async (req, res) => {
  const { email } = parseOrThrow(ForgotPasswordBody, req.body);
  parseOrThrow(EmailFormat, email);
  await authService.forgotPassword(email);
  res.json({ message: "If an account exists, we've sent a code." });
});

/** POST /api/auth/forgot-password/verify { email, otp } — step 2 of reset */
export const verifyResetCode = route("Failed to verify code", async (req, res) => {
  const { email, otp } = parseOrThrow(VerifyResetCodeBody, req.body);
  await authService.verifyResetCode(String(email), otp);
  res.json({ message: "Code verified", verified: true });
});

/** POST /api/auth/reset-password { email, otp?, newPassword } */
export const resetPassword = route("Failed to reset password", async (req, res) => {
  const { email, otp, newPassword } = parseOrThrow(ResetPasswordBody, req.body);
  parseOrThrow(PasswordLength, newPassword);
  await authService.resetPassword(String(email), otp ?? null, String(newPassword));
  res.json({ message: "Password reset successfully. You can now log in." });
});
