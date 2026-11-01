import { z } from "zod";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DROP_TITLE_MAX = 60;
export const DROP_DESCRIPTION_MAX = 300;
export const DROP_MAX_WALLPAPERS = 200;

/** ISO date-time string → Date; null clears it; undefined = unchanged. */
const when = (label: string) =>
  z
    .union([z.string(), z.null()], { message: `${label} must be a date` })
    .optional()
    .transform((v, ctx) => {
      if (v === undefined || v === null) return v;
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) {
        ctx.addIssue({ code: "custom", message: `${label} must be a date` });
        return z.NEVER;
      }
      return d;
    });

const body = z
  .object({
    title: z
      .string({ message: "Title is required" })
      .trim()
      .min(1, "Title is required")
      .max(DROP_TITLE_MAX, `Title can be at most ${DROP_TITLE_MAX} characters`)
      .optional(),
    description: z
      .union([z.string(), z.null()], { message: "Description must be text" })
      .optional()
      .transform((v) => (v === undefined ? undefined : v === null ? null : v.trim() || null))
      .refine((v) => v == null || v.length <= DROP_DESCRIPTION_MAX, `Description can be at most ${DROP_DESCRIPTION_MAX} characters`),
    startsAt: when("Start"),
    endsAt: when("End"),
    showOnApp: z.boolean({ message: "showOnApp must be true or false" }).optional(),
    showOnWeb: z.boolean({ message: "showOnWeb must be true or false" }).optional(),
    /** true = publish (goes live at startsAt), false = back to draft */
    published: z.boolean({ message: "published must be true or false" }).optional(),
  })
  .strict();

export const CreateDropBody = body.refine((b) => b.title !== undefined, { message: "Title is required", path: ["title"] });
export const UpdateDropBody = body;
export type DropBodyInput = z.output<typeof body>;

export const DropItemsBody = z
  .object({
    ids: z
      .array(z.string().regex(UUID, "Invalid wallpaper id"), { message: "ids must be a list of wallpaper ids" })
      .max(DROP_MAX_WALLPAPERS, `A drop can have at most ${DROP_MAX_WALLPAPERS} wallpapers`),
  })
  .strict();

export const DropIdParam = z.object({ id: z.string().regex(UUID, "Invalid drop id") });

export const SpotlightQuery = z.object({
  placement: z.enum(["app", "web"], { message: "placement must be app or web" }).default("app"),
});
