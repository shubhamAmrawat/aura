import { z } from "zod";
import { required } from "./common";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Checks run in the same order (and with the same messages) as before.
export const SendOtpBody = z.object({
  email: required("Email and type are required"),
  type: required("Email and type are required"),
});

export const EmailFormat = z.custom<string>(
  (value) => EMAIL_REGEX.test(value as string),
  "Invalid email format"
);

export const VerifyOtpBody = z.object({
  email: required("Email, code and type are required"),
  code: required("Email, code and type are required"),
  type: required("Email, code and type are required"),
});

export const SignupBody = z.object({
  email: required("All fields are required"),
  username: required("All fields are required"),
  displayName: required("All fields are required"),
  password: required("All fields are required"),
});

export const PasswordLength = z.custom<string>(
  (value) => !((value as { length?: number }).length! < 8),
  "Password must be at least 8 characters"
);

export type OtpType = "signup" | "login" | "password_reset";
