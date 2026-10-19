import { getOpenAI } from "../integrations/openai";
import { CATEGORY_AI_MODEL } from "./categoryAi.service";

/**
 * AI pre-screen of a creator application: one GPT-4o-mini vision call looks at every sample together
 * (so it can judge consistency) and scores each one. The score is a hint for the admin, never a decision.
 */
export type ScreenSample = { thumbUrl: string; width: number; height: number; bytes: number };
export type ScreenResult = {
  score: number;
  verdict: string;
  summary: string;
  /** Drafts of the note the applicant gets with each decision */
  approveMessage: string;
  rejectMessage: string;
  samples: { score: number; note: string }[];
};

const INSTRUCTIONS = `You help the team of a wallpaper website decide whether someone should become a creator who can
publish their own wallpapers. You get their sample images (small previews) with each original's pixel size and file size.

Score each sample 0–100 for how well it would work as a published wallpaper:
- Image quality: sharp, clean detail; no heavy compression, banding, noise or blur; not visibly upscaled from a small source.
- Made for screens: composition that works behind app icons and a clock; a clear subject or pleasing texture.
- Craft and appeal: lighting, colour, style — would people want this on their phone or desktop?
- Originality signals: screenshots, memes, collages, stock-looking reposts, or recognisable brand logos, franchise,
  anime, game or film characters lower the score. Name what you see in the note.
- Watermarks and signatures are ALLOWED when small and subtle (a corner signature or handle). Only lower the score when a
  watermark is large, centred, repeated or clearly hurts how the wallpaper looks — then say so in the note.
- Nudity, gore or hateful content: score 0 and say so.

Then the overall score 0–100 for the person as a creator: mostly the average quality, plus how consistent and
distinctive the set is. One weak sample in a strong set should not sink them.

note (per sample): at most 8 words, plain and specific ("Sharp, strong composition", "Looks upscaled — soft edges",
"Large watermark across the centre"). summary: 1–2 sentences for the admin, specific, no hype.

Also draft the two notes the team may send the applicant (only one is sent, after a human decides). Write as the Aurora
team, to the applicant ("you"), warm and specific. Name images by what they show ("your close-up of the pink flower",
"the cloud shot", "the neon street"). NEVER write "sample", "image 2", "the second/fourth one" or any number or score;
never mention AI or this review. No greeting or sign-off — the email
adds those. Plain text, no emojis, no exclamation-mark overload.
approve_message: 2–3 sentences, at most 380 characters: what stood out in their work, plus one small tip if there is a
useful one.
reject_message: 2–4 sentences, at most 420 characters: what to improve, concretely, based on the weakest points; mention
something that worked; end by inviting them to apply again with new samples.`;

const SCHEMA = {
  name: "creator_screen",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      samples: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: { score: { type: "integer" }, note: { type: "string" } },
          required: ["score", "note"],
        },
      },
      overall_score: { type: "integer" },
      summary: { type: "string" },
      approve_message: { type: "string" },
      reject_message: { type: "string" },
    },
    required: ["samples", "overall_score", "summary", "approve_message", "reject_message"],
  },
} as const;

const clamp = (n: unknown) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

/** Score → the label the admin sees. */
export function verdictFor(score: number): string {
  return score >= 75 ? "Likely approve" : score >= 55 ? "Borderline" : "Likely reject";
}

/** Throws on failure (the caller marks the application's AI status as failed). */
export async function screenApplication(samples: ScreenSample[]): Promise<ScreenResult> {
  const content = [
    ...samples.flatMap((s, i) => [
      { type: "text" as const, text: `Sample ${i + 1}: original ${s.width} × ${s.height} px, ${(s.bytes / 1024 / 1024).toFixed(1)} MB` },
      { type: "image_url" as const, image_url: { url: s.thumbUrl, detail: "low" as const } },
    ]),
    { type: "text" as const, text: `Return exactly ${samples.length} sample entries, in order.` },
  ];
  const res = await getOpenAI().chat.completions.create({
    model: CATEGORY_AI_MODEL,
    temperature: 0.2,
    max_tokens: 1000,
    response_format: { type: "json_schema", json_schema: SCHEMA as never },
    messages: [
      { role: "system", content: INSTRUCTIONS },
      { role: "user", content },
    ],
  });
  const raw = JSON.parse(res.choices[0]?.message?.content ?? "{}") as {
    samples?: { score?: number; note?: string }[];
    overall_score?: number;
    summary?: string;
    approve_message?: string;
    reject_message?: string;
  };
  // Fits the 500-character note limit the admin's send uses.
  const message = (m: unknown) => String(m ?? "").trim().slice(0, 500);
  const score = clamp(raw.overall_score);
  return {
    score,
    verdict: verdictFor(score),
    summary: String(raw.summary ?? "").trim().slice(0, 600),
    approveMessage: message(raw.approve_message),
    rejectMessage: message(raw.reject_message),
    samples: samples.map((_, i) => ({
      score: clamp(raw.samples?.[i]?.score),
      note: String(raw.samples?.[i]?.note ?? "").trim().slice(0, 120),
    })),
  };
}
