import type { Request, Response } from "express";
import { route } from "../utils/asyncRoute";
import { ApiError } from "../utils/ApiError";
import { authUserId, param, queryParam } from "../utils/request";
import { parseOrThrow } from "../utils/validate";
import { ALLOWED_IMAGE_TYPES } from "../validators/common";
import {
  ConfirmImageBody,
  ConfirmPasswordChangeBody,
  ImageUploadUrlBody,
  NewPasswordLength,
  UpdateProfileBody,
  UpdateUploadBody,
} from "../validators/profile.schema";
import * as profileService from "../services/profile.service";
import type { ImageKind } from "../services/profile.service";

// Handlers without route(): unexpected errors go to the central errorHandler (500),
// matching the previous API where these endpoints had no catch-all.

export async function getProfile(req: Request, res: Response) {
  const user = await profileService.getUserOrThrow(authUserId(req));
  res.json({
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
      hasPassword: user.passwordHash !== null,
      googleLinked: user.googleId !== null,
      role: user.role,
    },
  });
}

export async function updateProfile(req: Request, res: Response) {
  const input = parseOrThrow(UpdateProfileBody, req.body);
  const u = await profileService.updateProfile(authUserId(req), input);
  res.json({
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
}

// ─── Avatar / cover ────────────────────────────────────────

const LABEL: Record<ImageKind, string> = { avatar: "Avatar", cover: "Cover" };
const MAX_DIRECT_BYTES: Record<ImageKind, number> = { avatar: 5 * 1024 * 1024, cover: 10 * 1024 * 1024 };

export const imageUploadUrl = (kind: ImageKind) => async (req: Request, res: Response) => {
  const { fileType } = parseOrThrow(ImageUploadUrlBody, req.body);
  const { uploadUrl, fileUrl, key } = await profileService.createImageUploadUrl(authUserId(req), kind, fileType);
  res.json({ uploadUrl, fileUrl, key });
};

export const confirmImage = (kind: ImageKind) => async (req: Request, res: Response) => {
  const user = await profileService.getUserOrThrow(authUserId(req));
  const { fileUrl, key } = parseOrThrow(ConfirmImageBody, req.body);
  const url = await profileService.confirmImageUpload(user, kind, String(fileUrl), String(key));
  res.json({ message: `${LABEL[kind]} updated successfully`, [`${kind}Url`]: url });
};

/** Multipart fallback when the browser can't PUT to R2 directly (CORS / signed-URL issues). */
export const uploadImageDirect = (kind: ImageKind) => async (req: Request, res: Response) => {
  profileService.assertStorageConfigured(kind);
  const user = await profileService.getUserOrThrow(authUserId(req));

  const file = req.file;
  if (!file) throw new ApiError(400, `${LABEL[kind]} file is required.`);
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.mimetype)) {
    throw new ApiError(400, "Only JPEG, PNG and WebP images are allowed.");
  }
  if (file.size > MAX_DIRECT_BYTES[kind]) {
    throw new ApiError(400, `${LABEL[kind]} must be smaller than ${MAX_DIRECT_BYTES[kind] / 1024 / 1024}MB.`);
  }

  const url = await profileService.uploadImageDirect(user, kind, file);
  res.json({ message: `${LABEL[kind]} updated successfully`, [`${kind}Url`]: url });
};

// ─── Password ──────────────────────────────────────────────

export async function startPasswordChange(req: Request, res: Response) {
  await profileService.startPasswordChange(authUserId(req), req.body?.currentPassword);
  res.json({ message: "OTP sent to your email." });
}

export async function confirmPasswordChange(req: Request, res: Response) {
  const userId = authUserId(req);
  await profileService.getUserOrThrow(userId);
  const { otp, newPassword } = parseOrThrow(ConfirmPasswordChangeBody, req.body);
  parseOrThrow(NewPasswordLength, newPassword);
  await profileService.confirmPasswordChange(userId, otp, newPassword as string);
  res.json({ message: "Password changed successfully." });
}

// ─── Account ───────────────────────────────────────────────

/** Accounts without a password (Google sign-up) confirm deletion with an emailed code. */
export async function sendDeleteAccountOtp(req: Request, res: Response) {
  await profileService.sendDeleteAccountOtp(authUserId(req));
  res.json({ message: "We've sent a code to your email." });
}

/** DELETE /api/profile — body { password } or, for accounts without a password, { otp } */
export async function deleteAccount(req: Request, res: Response) {
  await profileService.deleteAccount(authUserId(req), { password: req.body?.password, otp: req.body?.otp });
  res.json({ message: "Account deleted successfully." });
}

// ─── My uploads ────────────────────────────────────────────

export const listUploads = route("Failed to fetch uploads", async (req, res) => {
  const limit = Math.min(Number(queryParam(req, "limit")) || 24, 50);
  const offset = Math.max(0, Number(queryParam(req, "offset")) || 0);
  res.json(await profileService.listUploads(authUserId(req), limit, offset));
});

export const updateUpload = route("Failed to update wallpaper", async (req, res) => {
  const input = parseOrThrow(UpdateUploadBody, req.body);
  const data = await profileService.updateUpload(authUserId(req), param(req, "id"), input);
  res.json({ data });
});

export const deleteUpload = route("Failed to delete wallpaper", async (req, res) => {
  await profileService.deleteUpload(authUserId(req), param(req, "id"));
  res.json({ message: "Wallpaper deleted" });
});
