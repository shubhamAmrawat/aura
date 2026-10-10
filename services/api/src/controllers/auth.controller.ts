import { route } from "../utils/asyncRoute";
import { ApiError } from "../utils/ApiError";
import { parseOrThrow } from "../utils/validate";
import { setAuthCookie, clearAuthCookie } from "../utils/cookies";
import { verifyToken } from "../utils/jwt";
import { getAuthToken } from "../middleware/auth";
import { EmailFormat, PasswordLength, SendOtpBody, SignupBody, VerifyOtpBody } from "../validators/auth.schema";
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
