import { getOpenAI, generateTextEmbedding } from "../integrations/openai";
import { CATEGORY_AI_MODEL, GUIDE, type CategoryOption } from "./categoryAi.service";

/**
 * One GPT-4o-mini vision call per upload that does everything the upload needs from the image:
 * a clean title, a page description, tags, the best category (+ runner-up), and a visual
 * description used for the search/similarity vector. Pass the 600px thumbnail URL.
 */
export type UploadAnalysis = {
  title: string | null;
  description: string | null;
  tags: string[];
  categoryId: string | null;
  alternativeId: string | null;
  confidence: number;
  newCategoryIdea: string | null;
  reason: string;
  /** What the image looks like, in words — combined with the final title/tags into the search vector. */
  visualDescription: string;
};

function instructions(options: CategoryOption[]) {
  const list = options.map((c) => `- ${c.slug}: ${c.name} — ${GUIDE[c.slug] ?? c.name}`).join("\n");
  return `You catalogue wallpapers for a wallpaper website. From the image (and the file name / tags given as hints), return JSON.

visual_description: 1–2 sentences for similarity search — subject, style, colours, mood, searchable keywords.

title: 3–8 words, Title Case, what is visible (subject, setting, mood). No quotes, no trailing period, no resolution,
file numbers, "wallpaper", "4K" or "HD". No brand, franchise, character or real-person names.

description: 2–3 plain, specific sentences, 250–420 characters: what the image shows, its style and colours, the mood,
and what kind of screen or setup it suits. Start with the subject (never "This image", "The image" or "This wallpaper").
Describe only what is visible; describe recognisable characters generically, never by name. No hype words (stunning,
breathtaking, captivating, mesmerizing), no exclamation marks, no emojis; don't mention resolution, file format or downloading.

tags: 5–8 lowercase search tags (1–2 words each): subject, setting, style, colours, mood. No franchise or character names.

category: the ONE category a visitor would most expect to find it in. Categories (slug: name — meaning):
${list}
A clear SUBJECT wins over a STYLE (an anime character on a dark background is "anime"; Krishna is "hinduism").
Use a STYLE category only when there is no clear subject. Anything showing anime/manga, superhero/comic, video game, film or
TV characters MUST go in anime, superheroes or games-franchises (when those exist).
alternative: the second-best category, or "none". confidence: 0.9+ obvious, 0.7–0.9 likely, below 0.7 unsure.
If nothing fits, category "none" and a short new category name in new_category_idea; otherwise new_category_idea is "".
reason: max 12 words.`;
}

function schema(slugs: string[]) {
  const choice = { type: "string", enum: [...slugs, "none"] };
  return {
    name: "upload_analysis",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        visual_description: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        category: choice,
        alternative: choice,
        confidence: { type: "number" },
        new_category_idea: { type: "string" },
        reason: { type: "string" },
      },
      required: ["visual_description", "title", "description", "tags", "category", "alternative", "confidence", "new_category_idea", "reason"],
    },
  } as const;
}

const cleanTitle = (t: unknown) => {
  const s = String(t ?? "").replace(/["“”]/g, "").replace(/\s+/g, " ").replace(/\.$/, "").trim().slice(0, 100);
  return s.length >= 3 ? s : null;
};
const cleanTags = (t: unknown) =>
  Array.isArray(t)
    ? [...new Set(t.map((x) => String(x).trim().toLowerCase()).filter((x) => x.length >= 2 && x.length <= 30))].slice(0, 8)
    : [];

/**
 * Search/similarity vector for a wallpaper — same recipe as generateVisionEmbedding:
 * the AI's visual description + the final title, description and tags → text-embedding-3-small.
 */
export function embedWallpaper(visualDescription: string, text: { title: string; description: string | null; tags: string[] }) {
  const parts = [visualDescription, text.title, text.description, text.tags.join(", ")].filter(Boolean);
  return generateTextEmbedding(parts.join(". "));
}

/**
 * Analyse an uploaded wallpaper. Never throws — on failure returns an empty analysis
 * (no title/description/tags/category) and the upload carries on.
 */
export async function analyzeUpload(
  imageUrl: string,
  hints: { title: string; tags: string[] },
  options: CategoryOption[]
): Promise<UploadAnalysis> {
  const empty: UploadAnalysis = {
    title: null, description: null, tags: [], categoryId: null, alternativeId: null,
    confidence: 0, newCategoryIdea: null, reason: "AI analysis failed", visualDescription: "",
  };
  try {
    const res = await getOpenAI().chat.completions.create({
      model: CATEGORY_AI_MODEL,
      temperature: 0.4,
      max_tokens: 600,
      response_format: { type: "json_schema", json_schema: schema(options.map((c) => c.slug)) as never },
      messages: [
        { role: "system", content: instructions(options) },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
            { type: "text", text: `File name / title hint: ${hints.title}\nTags given: ${hints.tags.join(", ") || "none"}` },
          ],
        },
      ],
    });
    const raw = JSON.parse(res.choices[0]?.message?.content ?? "{}");
    const bySlug = new Map(options.map((c) => [c.slug, c.id]));
    const idOf = (s: unknown) => (typeof s === "string" && s !== "none" ? bySlug.get(s) ?? null : null);
    const description = String(raw.description ?? "").replace(/\s+/g, " ").trim();
    const out: UploadAnalysis = {
      title: cleanTitle(raw.title),
      description: description.length >= 80 ? description.slice(0, 600) : null,
      tags: cleanTags(raw.tags),
      categoryId: idOf(raw.category),
      alternativeId: idOf(raw.alternative),
      confidence: Math.max(0, Math.min(1, Number(raw.confidence) || 0)),
      newCategoryIdea: typeof raw.new_category_idea === "string" && raw.new_category_idea.trim() ? raw.new_category_idea.trim().slice(0, 40) : null,
      reason: String(raw.reason ?? "").slice(0, 200),
      visualDescription: String(raw.visual_description ?? "").replace(/\s+/g, " ").trim().slice(0, 600),
    };
    return out;
  } catch (e) {
    console.error("[upload-ai] analysis failed:", e instanceof Error ? e.message : e);
    return empty;
  }
}
