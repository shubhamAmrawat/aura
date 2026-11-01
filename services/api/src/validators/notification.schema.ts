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
    deviceName: z.string().trim().max(60).nullable().optional(),
    osVersion: z.string().trim().max(30).nullable().optional(),
  })
  // not .strict(): fields a newer app sends that this server doesn't know yet are ignored, not refused
  .strip();

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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const link = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v.startsWith("/") || v.startsWith("https://") || v === "aurora://update", "Links start with / or https://");

/** A tap on a notification (or one of its buttons): d = delivery id, a = button id or "tap". */
export const OpenedBody = z.object({ d: z.string().regex(UUID), a: z.string().trim().max(40).optional() }).strict();

export const WebSubscribeBody = z
  .object({
    endpoint: z.string().url().max(800),
    keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
  })
  .passthrough();
export const WebEndpointBody = z.object({ endpoint: z.string().url().max(800) }).strict();
export const WebPrefsBody = z
  .object({
    endpoint: z.string().url().max(800),
    prefs: z.object({ drops: pref, daily: pref, updates: pref, uploads: pref, milestones: pref, account: pref }).strict(),
  })
  .strict();

export const AudienceSchema = z
  .object({
    kind: z.enum(["everyone", "signedIn", "signedOut", "creators", "users", "devices"]),
    userIds: z.array(z.string().regex(UUID)).max(100).optional(),
    targets: z.array(z.string().min(10).max(800)).max(200).optional(),
    screen: z.enum(["mobile", "tablet"]).nullable().optional(),
    versionBelow: z.string().regex(/^\d{1,3}\.\d{1,3}\.\d{1,4}$/, "Versions look like 1.0.2").nullable().optional(),
    activeDays: z.number().int().min(-365).max(365).nullable().optional(),
    includeWeb: z.boolean().optional(),
  })
  .strict()
  .refine((a) => a.kind !== "users" || (a.userIds?.length ?? 0) > 0, "Pick at least one person")
  .refine((a) => a.kind !== "devices" || (a.targets?.length ?? 0) > 0, "Pick at least one phone or browser");

export const ManualMessageSchema = z
  .object({
    type: z.enum(["announcement", "update", "drop"]),
    title: z.string().trim().min(1, "Title is required").max(65, "Titles can be at most 65 characters"),
    body: z.string().trim().max(240, "Messages can be at most 240 characters").nullable().optional().transform((v) => v || null),
    imageUrl: z.string().trim().max(500).refine((v) => v.startsWith("https://"), "Images must be https links").nullable().optional().transform((v) => v || null),
    url: link.nullable().optional().transform((v) => v || null),
    actions: z
      .array(z.object({ id: z.string().regex(/^[a-z0-9_]{1,20}$/), label: z.string().trim().min(1).max(24), url: link }).strict())
      .max(2)
      .default([]),
  })
  .strict();

export const SendBody = z
  .object({
    message: ManualMessageSchema,
    audience: AudienceSchema,
    /** ISO date-time; null = now */
    scheduledFor: z.string().nullable().optional().transform((v, ctx) => {
      if (!v) return null;
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) {
        ctx.addIssue({ code: "custom", message: "Invalid time" });
        return z.NEVER;
      }
      return d;
    }),
    respectQuiet: z.boolean().default(true),
  })
  .strict();

export const TestBody = z.object({ message: ManualMessageSchema }).strict();
export const PreviewBody = z.object({ audience: AudienceSchema, type: z.enum(["announcement", "update", "drop"]).default("announcement") }).strict();

export const CampaignListQuery = z.object({
  filter: z.enum(["all", "manual", "auto", "scheduled"]).default("all"),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
});

const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Times look like 22:00");
export const RulesBody = z
  .object({
    quietStart: HHMM,
    quietEnd: HHMM,
    dailyCap: z.number().int().min(0).max(20),
    auto: z.object({ drop: z.boolean(), daily: z.boolean(), upload_live: z.boolean(), upload_rejected: z.boolean(), milestone: z.boolean(), creator: z.boolean(), report: z.boolean() }),
    alerts: z.object({ report: z.boolean(), application: z.boolean(), deliveryProblems: z.boolean() }),
  })
  .strict();

export const UserSearchQuery = z.object({ q: z.string().trim().min(1).max(60) });
export const TargetBody = z.object({ target: z.string().min(10).max(800) }).strict();
export const IdParam = z.object({ id: z.string().regex(UUID, "Invalid id") });
