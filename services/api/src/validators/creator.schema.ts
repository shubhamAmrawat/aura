import { z } from "zod";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const intIn = (min: number, max: number, fallback: number) =>
  z.preprocess((v) => (v === undefined || v === "" ? fallback : Number(v)), z.number().int().min(min).max(max));

/** Optional text: trimmed, empty → null. */
const optionalText = (max: number, message: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() || null : v ?? null),
    z.string().max(max, message).nullable()
  );

export const SampleUrlBody = z.object({
  fileType: z.string({ message: "fileType is required." }),
  size: z.number({ message: "size is required." }),
});

export const SampleConfirmBody = z.object({
  key: z.string({ message: "key is required." }).min(1, "key is required."),
});

export const IdParam = z.object({ id: z.string().regex(UUID, "Invalid id") });

export const SubmitApplicationBody = z.object({
  sampleIds: z.array(z.string().regex(UUID, "Invalid image id."), { message: "Add your wallpapers." }),
  about: optionalText(1000, "Keep “About your work” under 1000 characters."),
  portfolioUrl: z.preprocess(
    (v) => {
      if (typeof v !== "string" || !v.trim()) return null;
      const t = v.trim();
      return /^https?:\/\//i.test(t) ? t : `https://${t}`;
    },
    z
      .string()
      .max(300, "That link is too long.")
      .refine((u) => {
        try {
          const { protocol, hostname } = new URL(u);
          return (protocol === "https:" || protocol === "http:") && hostname.includes(".");
        } catch {
          return false;
        }
      }, "Enter a valid link, like instagram.com/yourname.")
      .nullable()
  ),
});

export const AdminApplicationsQuery = z.object({
  status: z.enum(["pending", "approved", "rejected"], { message: "status must be pending, approved or rejected" }).default("pending"),
  limit: intIn(1, 100, 50),
  offset: intIn(0, 100_000, 0),
});

export const ApproveBody = z.object({ note: optionalText(500, "Keep the note under 500 characters.") });

export const RejectApplicationBody = z.object({
  note: z
    .string({ message: "Add a note for the applicant (3–500 characters)." })
    .trim()
    .min(3, "Add a note for the applicant (3–500 characters).")
    .max(500, "Keep the note under 500 characters."),
});
