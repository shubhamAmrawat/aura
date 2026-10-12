import { getOpenAI } from "../integrations/openai";

export const CATEGORY_AI_MODEL = "gpt-4o-mini";

/** Plain-language meaning of each category for the classifier (falls back to the category name). */
const GUIDE: Record<string, string> = {
  nature: "natural scenery: landscapes, fields, deserts, lakes, rivers, waterfalls, sky, plants, wildlife (not cats)",
  mountains: "mountains or hills are the main subject",
  forest: "forests, woods, trees as the main subject",
  ocean: "sea, ocean, waves, beaches, underwater",
  sunset: "sunsets or sunrises are the main subject",
  floral: "flowers or blossoms are the main subject",
  space: "outer space: galaxies, nebulae, planets, stars, astronauts",
  astrology: "zodiac signs, horoscope, astrological symbols and mystic cosmic symbolism",
  anime: "anime or manga characters / scenes (Japanese animation style), incl. One Piece, Naruto, Demon Slayer etc.",
  superheroes: "superheroes and comic-book characters (Marvel, DC — Iron Man, Batman, Spider-Man …)",
  hinduism: "Hindu gods, deities and mythology (Krishna, Shiva, Hanuman, Ganesha, Rama …), temples, spiritual Hindu art",
  cars: "cars, motorbikes and other vehicles as the main subject",
  cats: "cats",
  city: "cities, streets, skylines, urban scenes",
  architecture: "buildings, interiors, monuments, architectural detail",
  "sci-fi": "science fiction: spaceships, robots, futuristic technology, alien worlds",
  cyberpunk: "cyberpunk: neon-lit futuristic cities, high-tech dystopia",
  sports: "sports, athletes, stadiums",
  abstract: "STYLE — abstract art, no clear real-world subject",
  dark: "STYLE — mostly black/very dark, moody; use only when there is no clearer subject",
  minimal: "STYLE — minimalist, simple composition, lots of empty space",
  neon: "STYLE — glowing neon lights / neon colours as the defining look",
  gradient: "STYLE — smooth colour gradients",
  geometric: "STYLE — geometric shapes and patterns",
};

export type CategoryOption = { id: string; slug: string; name: string };
export type CategoryVerdict = {
  categoryId: string | null;
  alternativeId: string | null;
  confidence: number;
  currentFits: boolean | null;
  newCategoryIdea: string | null;
  reason: string;
  usedImage: boolean;
  tokens: { input: number; output: number };
};

function instructions(options: CategoryOption[]) {
  const list = options.map((c) => `- ${c.slug}: ${c.name} — ${GUIDE[c.slug] ?? c.name}`).join("\n");
  return `You sort wallpapers into the browse categories of a wallpaper website.

Categories (slug: name — meaning):
${list}

Rules:
- Pick the ONE category a visitor would most expect to find this wallpaper in.
- A clear SUBJECT wins over a STYLE: an anime character on a dark background is "anime"; Krishna is "hinduism"; Iron Man is "superheroes". Use a STYLE category only when there is no clear subject.
- confidence: 0.9+ obvious, 0.7–0.9 likely, below 0.7 unsure.
- alternative: the second-best category, or "none".
- current_fits: true if the CURRENT category is also a reasonable place for it (even if not the best); false if it is clearly wrong. If there is no current category, false.
- If nothing fits well, use "none" and suggest a short new category name in new_category_idea; otherwise new_category_idea is "".
- reason: max 12 words.`;
}

function schema(slugs: string[]) {
  const choice = { type: "string", enum: [...slugs, "none"] };
  return {
    name: "category_verdict",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        category: choice,
        alternative: choice,
        confidence: { type: "number" },
        current_fits: { type: "boolean" },
        new_category_idea: { type: "string" },
        reason: { type: "string" },
      },
      required: ["category", "alternative", "confidence", "current_fits", "new_category_idea", "reason"],
    },
  } as const;
}

/**
 * Ask GPT-4o-mini (image at detail:low + title/tags/description) which category fits.
 * Falls back to text only if the image can't be fetched by OpenAI (e.g. > 20 MB).
 */
export async function classifyWallpaperCategory(
  input: { imageUrl: string | null; title: string; description?: string | null; tags?: string[] | null; currentCategoryName?: string | null },
  options: CategoryOption[]
): Promise<CategoryVerdict> {
  const bySlug = new Map(options.map((c) => [c.slug, c.id]));
  const text = [
    `Title: ${input.title}`,
    input.tags?.length ? `Tags: ${input.tags.join(", ")}` : null,
    input.description ? `Description: ${input.description.slice(0, 400)}` : null,
    `Current category: ${input.currentCategoryName ?? "none"}`,
  ]
    .filter(Boolean)
    .join("\n");

  const run = async (withImage: boolean) => {
    const res = await getOpenAI().chat.completions.create({
      model: CATEGORY_AI_MODEL,
      temperature: 0,
      max_tokens: 150,
      response_format: { type: "json_schema", json_schema: schema(options.map((c) => c.slug)) as never },
      messages: [
        { role: "system", content: instructions(options) },
        {
          role: "user",
          content: withImage && input.imageUrl
            ? [{ type: "image_url", image_url: { url: input.imageUrl, detail: "low" } }, { type: "text", text }]
            : text,
        },
      ],
    });
    const raw = JSON.parse(res.choices[0]?.message?.content ?? "{}");
    return { raw, usage: res.usage };
  };

  let usedImage = !!input.imageUrl;
  let out;
  try {
    out = await run(usedImage);
  } catch (err) {
    if (!usedImage) throw err;
    usedImage = false; // image too large / unreachable for OpenAI → decide from the text
    out = await run(false);
  }
  const { raw, usage } = out;
  const idOf = (s: unknown) => (typeof s === "string" && s !== "none" ? bySlug.get(s) ?? null : null);
  return {
    categoryId: idOf(raw.category),
    alternativeId: idOf(raw.alternative),
    confidence: Math.max(0, Math.min(1, Number(raw.confidence) || 0)),
    currentFits: input.currentCategoryName ? Boolean(raw.current_fits) : null,
    newCategoryIdea: typeof raw.new_category_idea === "string" && raw.new_category_idea.trim() ? raw.new_category_idea.trim().slice(0, 40) : null,
    reason: String(raw.reason ?? "").slice(0, 200),
    usedImage,
    tokens: { input: usage?.prompt_tokens ?? 0, output: usage?.completion_tokens ?? 0 },
  };
}
