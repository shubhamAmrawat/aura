import { z } from "zod";

/**
 * Every environment variable the API reads, validated once at boot.
 * Only DATABASE_URL and JWT_SECRET are required (same as before: everything
 * else was read lazily, so the server must still boot without them).
 */
const EnvSchema = z.object({
  NODE_ENV: z.string().optional(),
  PORT: z.string().optional(),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  ADMIN_SECRET: z.string().optional(),

  // Cloudflare R2
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),

  // Email (Brevo). EMAIL_TRANSPORT=log prints OTPs instead of sending (tests only).
  BREVO_API_KEY: z.string().optional(),
  BREVO_FROM_EMAIL: z.string().optional(),
  EMAIL_TRANSPORT: z.string().optional(),

  // AI + moderation
  OPENAI_API_KEY: z.string().optional(),
  SIGHTENGINE_API_USER: z.string().optional(),
  SIGHTENGINE_API_SECRET: z.string().optional(),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment configuration:\n${details}`);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === "production";
