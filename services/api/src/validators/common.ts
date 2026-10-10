import { z } from "zod";

/**
 * Truthy check with a custom message — mirrors the old `if (!value)` guards exactly
 * (empty string, null, undefined, 0, false all fail; other types are passed through).
 */
export const required = <T = string>(message: string) =>
  z.custom<T>((value) => Boolean(value), message);

/** Mirrors `if (!value?.trim())` — must be a string with non-whitespace content. */
export const requiredTrimmed = (message: string) =>
  z.custom<string>((value) => typeof value === "string" && value.trim().length > 0, message);

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
