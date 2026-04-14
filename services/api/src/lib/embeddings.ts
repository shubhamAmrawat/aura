/**
 * Embedding strategy (zero in-process ML — no RAM pressure on Render):
 *
 * 1. generateVisionEmbedding(imageUrl, metadata)
 *    - Calls GPT-4o-mini (detail:"low") to generate a rich visual description
 *      of the image: colors, mood, style, subject matter, aesthetic keywords.
 *    - Combines that description with user-provided title/tags/description.
 *    - Embeds the combined text with OpenAI text-embedding-3-small (512-dim).
 *    - Stored in `text_embedding` column at upload time (async, non-blocking).
 *    - Powers BOTH /:id/similar AND /search (same vector space ✓).
 *    - Cost: ~$0.0001–0.0002 per wallpaper (negligible).
 *
 * 2. generateTextEmbedding(text)
 *    - Embeds a plain text string (used for search queries).
 *
 * 3. generateWallpaperTextEmbedding(metadata)
 *    - Embeds title+description+tags without vision (used for backfill/reembed
 *      when we don't have the image URL handy).
 */

import OpenAI from "openai";

function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey });
}

// ─── Vision + text embedding (used at upload time) ────────────────────────────

/**
 * Describe the image with GPT-4o-mini (detail:low → fast + cheap),
 * combine with wallpaper metadata, then embed the result.
 * Total: ~1.5s in background. User never waits — called inside setImmediate.
 */
export async function generateVisionEmbedding(
  imageUrl: string,
  metadata: {
    title: string;
    description?: string | null;
    tags?: string[] | null;
  }
): Promise<number[] | null> {
  try {
    const openai = getOpenAI();

    // Step 1 — visual description (~1s, detail:low keeps it fast and cheap)
    const vision = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 120,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imageUrl, detail: "low" },
            },
            {
              type: "text",
              text: "Describe this wallpaper in 1–2 sentences for a visual similarity search. Focus on: visual style, color palette, mood, subject matter, and aesthetic keywords. Be concise.",
            },
          ],
        },
      ],
    });

    const visualDescription = vision.choices[0]?.message?.content?.trim() ?? "";
    if (visualDescription) {
      console.log(`[embedding] Vision description: "${visualDescription.slice(0, 80)}..."`);
    }

    // Step 2 — combine vision description + user metadata for a richer vector
    const parts = [
      visualDescription,
      metadata.title,
      metadata.description,
      metadata.tags?.length ? metadata.tags.join(", ") : null,
    ].filter(Boolean);

    if (parts.length === 0) return null;

    // Step 3 — embed combined text (~200ms)
    return generateTextEmbedding(parts.join(". "));
  } catch (err) {
    console.error("[embedding] Vision embedding failed:", err);
    return null;
  }
}

// ─── Text embedding (used for search queries) ─────────────────────────────────

/**
 * Embed a plain text string with OpenAI text-embedding-3-small (512-dim).
 * Used for search queries. Zero RAM.
 */
export async function generateTextEmbedding(
  text: string
): Promise<number[] | null> {
  try {
    const openai = getOpenAI();
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text.trim(),
      dimensions: 512,
    });
    return response.data[0]?.embedding ?? null;
  } catch (err) {
    console.error("[embedding] Text embedding failed:", err);
    return null;
  }
}

// ─── Metadata-only embedding (used for backfill / reembed endpoint) ───────────

/**
 * Embed wallpaper metadata without vision analysis.
 * Used when we only have title/tags/description (no image URL),
 * e.g. the /reembed-text admin endpoint and the backfill script.
 */
export async function generateWallpaperTextEmbedding(metadata: {
  title: string;
  description?: string | null;
  tags?: string[] | null;
}): Promise<number[] | null> {
  const parts = [
    metadata.title,
    metadata.description,
    metadata.tags?.length ? metadata.tags.join(", ") : null,
  ].filter(Boolean);

  if (parts.length === 0) return null;
  return generateTextEmbedding(parts.join(". "));
}
