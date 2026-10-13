import { and, eq, sql } from "drizzle-orm";
import { db } from "../config/db";
import { wallpapers } from "../models";
import { getOpenAI } from "../integrations/openai";
import { visibleCategorySql } from "../utils/screenFilter";
import { thumbUrlSql } from "./wallpaperThumb.service";

/** Descriptions shorter than this (or missing, or just the title again) get rewritten. */
export const MIN_DESCRIPTION_CHARS = 80;

const needsDescription = sql`(
  ${wallpapers.description} IS NULL
  OR length(trim(${wallpapers.description})) < ${MIN_DESCRIPTION_CHARS}
  OR lower(trim(${wallpapers.description})) = lower(trim(${wallpapers.title}))
)`;

const SYSTEM_PROMPT = [
  "You write the description shown on a wallpaper's download page.",
  'Return JSON: {"description": string}.',
  "Write 2–3 plain, specific sentences, 250–420 characters in total:",
  "what the image shows, its style and colours, the mood, and what kind of screen or setup it suits.",
  "Describe only what is visible. Do not name brands, franchises, real people or copyrighted characters,",
  "even if you recognise them; describe them generically instead.",
  "Start with the subject itself (e.g. \"A red hatchback…\", \"Snow-capped peaks…\"), never with \"This image\", \"The image\" or \"This wallpaper\".",
  "Vary the wording; avoid the phrase \"making it suitable for\".",
  "No hype words (stunning, breathtaking, captivating, mesmerizing, vibrant tapestry, myriad), no exclamation marks, no emojis,",
  "and do not mention resolution, file format or downloading.",
].join(" ");

/** Ask GPT-4o-mini for a page description of one wallpaper. Returns null on any failure. */
export async function generateDescription(input: {
  imageUrl: string;
  title: string;
  tags: string[];
  isMobile: boolean;
}): Promise<string | null> {
  try {
    const res = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 220,
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: input.imageUrl, detail: "low" } },
            {
              type: "text",
              text: `Title: ${input.title}\nTags: ${input.tags.slice(0, 10).join(", ") || "none"}\nUsed as: ${input.isMobile ? "phone" : "desktop"} wallpaper`,
            },
          ],
        },
      ],
    });
    const raw = res.choices[0]?.message?.content;
    if (!raw) return null;
    const text = String((JSON.parse(raw) as { description?: unknown }).description ?? "")
      .replace(/\s+/g, " ")
      .trim();
    return text.length >= MIN_DESCRIPTION_CHARS ? text.slice(0, 600) : null;
  } catch (e) {
    console.error("[descriptions] generation failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Live, publicly visible wallpapers whose description is missing or too thin. */
export async function listNeedingDescription(limit: number) {
  return db
    .select({
      id: wallpapers.id,
      title: wallpapers.title,
      description: wallpapers.description,
      tags: wallpapers.tags,
      isMobile: wallpapers.isMobile,
      fileUrl: wallpapers.fileUrl,
      thumbUrl: thumbUrlSql,
    })
    .from(wallpapers)
    .where(and(eq(wallpapers.status, "approved"), visibleCategorySql, needsDescription))
    .orderBy(sql`random()`)
    .limit(limit);
}

export async function countNeedingDescription() {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(wallpapers)
    .where(and(eq(wallpapers.status, "approved"), visibleCategorySql, needsDescription));
  return row?.n ?? 0;
}

/** Write descriptions for up to `limit` wallpapers that need one. */
export async function fillMissingDescriptions(limit = 20, concurrency = 3) {
  const rows = await listNeedingDescription(limit);
  let written = 0;
  let failed = 0;
  let i = 0;
  const worker = async () => {
    while (i < rows.length) {
      const row = rows[i++]!;
      const description = await generateDescription({
        imageUrl: row.thumbUrl ?? row.fileUrl,
        title: row.title,
        tags: row.tags ?? [],
        isMobile: row.isMobile,
      });
      if (!description) {
        failed++;
        continue;
      }
      await db.update(wallpapers).set({ description, updatedAt: new Date() }).where(eq(wallpapers.id, row.id));
      written++;
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  return { written, failed, remaining: await countNeedingDescription() };
}
