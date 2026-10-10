import { z } from "zod";
import { ALLOWED_IMAGE_TYPES, required, requiredTrimmed } from "./common";

export const UpdateProfileBody = z.object({
  displayName: z.any().optional(),
  bio: z.any().optional(),
  contactNo: z.any().optional(),
  username: z.any().optional(),
});

export const ImageUploadUrlBody = z.object({
  fileType: z.custom<(typeof ALLOWED_IMAGE_TYPES)[number]>(
    (v) => (ALLOWED_IMAGE_TYPES as readonly unknown[]).includes(v),
    "Only JPEG, PNG and WebP images are allowed."
  ),
});

export const ConfirmImageBody = z.object({
  fileUrl: required("fileUrl and key are required."),
  key: required("fileUrl and key are required."),
});

export const ConfirmPasswordChangeBody = z.object({
  otp: required("OTP and new password are required."),
  newPassword: required("OTP and new password are required."),
});

export const NewPasswordLength = z.custom<string>(
  (value) => !((value as { length?: number }).length! < 8),
  "Password must be at least 8 characters."
);

export const UpdateUploadBody = z.object({
  title: requiredTrimmed("Title is required"),
  description: z.any().optional(),
  tags: z.any().optional(),
  categoryId: z.any().optional(),
});
