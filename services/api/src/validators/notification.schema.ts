import { z } from "zod";

const screen = z.enum(["mobile", "tablet"], { message: "screen must be mobile or tablet" });
const token = z.string({ message: "token is required" }).trim().min(10, "Invalid token").max(200, "Invalid token");
const isoDate = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Invalid date" });
      return z.NEVER;
    }
    return d;
  });

export const InboxQuery = z.object({
  screen: screen.optional(),
  /** signed out: when this device last opened the inbox */
  since: isoDate,
  before: isoDate,
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

export const RegisterDeviceBody = z
  .object({
    token,
    screen: screen.default("mobile"),
    platform: z.enum(["android", "ios"]).default("android"),
    appVersion: z.string().trim().max(20).nullable().optional(),
  })
  .strict();

export const TokenQuery = z.object({ token });
export const TokenBody = z.object({ token }).strict();

const pref = z.boolean().optional();
export const DevicePrefsBody = z
  .object({
    token,
    prefs: z.object({ drops: pref, daily: pref, updates: pref, uploads: pref, milestones: pref, account: pref }).strict(),
  })
  .strict();

export const AdminBroadcastBody = z
  .object({
    type: z.enum(["announcement", "update"]),
    title: z.string().trim().min(1, "Title is required").max(80, "Title can be at most 80 characters"),
    body: z.string().trim().max(200, "Message can be at most 200 characters").optional().transform((v) => v || null),
    /** a path like /collection/… or an https link; empty = the inbox (update: the Play page) */
    url: z
      .string()
      .trim()
      .max(300)
      .optional()
      .transform((v) => v || null)
      .refine((v) => v === null || v.startsWith("/") || v.startsWith("https://"), "Link must start with / or https://"),
  })
  .strict();

export const AppVersionsBody = z
  .object({
    latest: z.string().trim().nullable().transform((v) => v || null),
    min: z.string().trim().nullable().transform((v) => v || null),
  })
  .strict();
