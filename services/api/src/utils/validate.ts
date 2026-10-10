import type { z } from "zod";
import { ApiError } from "./ApiError";

/**
 * Parse with a zod schema; on failure throw 400 with the FIRST issue's message.
 * Schemas list fields in the same order the old handlers checked them, so the
 * first message is exactly what clients used to receive.
 */
export function parseOrThrow<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data ?? {});
  if (!result.success) {
    throw new ApiError(400, result.error.issues[0]?.message ?? "Invalid request");
  }
  return result.data;
}
