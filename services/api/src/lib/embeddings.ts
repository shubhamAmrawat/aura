/**
 * Dual-embedding strategy:
 *
 * 1. generateImageEmbedding(imageUrl)   → @xenova CLIP ViT-B/32, 512-dim
 *    Stored in `embedding` column. Powers /:id/similar (visual similarity).
 *    Model loads lazily on first upload (async, never blocks a response).
 *    Only the vision encoder is loaded here (~250MB), NOT the text tower.
 *
 * 2. generateTextEmbedding(text)        → OpenAI text-embedding-3-small, 512-dim
 *    Used for search QUERIES. Zero in-process RAM.
 *
 * 3. generateWallpaperTextEmbedding()   → wraps (2) for wallpaper metadata
 *    Stored in `text_embedding` column. Powers /search semantic matching.
 *
 * Why two columns instead of one:
 *   CLIP image vectors and OpenAI text vectors live in different mathematical
 *   spaces. Comparing them via cosine similarity would produce nonsense.
 *   Keeping them separate lets each column do exactly the job it's designed for.
 */

import OpenAI from "openai";

// ─── CLIP image embeddings (vision encoder only) ──────────────────────────────

let extractor: any = null;

async function getImageExtractor() {
  if (!extractor) {
    const { pipeline, env } = await import("@xenova/transformers");
    env.cacheDir = "./.cache";
    extractor = await pipeline(
      "image-feature-extraction",
      "Xenova/clip-vit-base-patch32"
    );
  }
  return extractor;
}

/**
 * Generate a 512-dim CLIP visual embedding for an image.
 * Stored in the `embedding` column at upload time (async).
 * Powers the "similar wallpapers" section via image↔image cosine similarity.
 */
export async function generateImageEmbedding(
  imageUrl: string
): Promise<number[] | null> {
  try {
    const model = await getImageExtractor();
    const output = await model(imageUrl, { pooling: "mean", normalize: true });
    return Array.from(output.data) as number[];
  } catch (err) {
    console.error("[embedding] CLIP image embedding failed:", err);
    return null;
  }
}

// ─── OpenAI text embeddings ───────────────────────────────────────────────────

function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey });
}

/**
 * Generate a 512-dim text embedding via OpenAI text-embedding-3-small.
 * Used for search QUERIES. dimensions=512 keeps it compatible with the
 * text_embedding column without a schema change.
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
    console.error("[embedding] OpenAI text embedding failed:", err);
    return null;
  }
}

/**
 * Generate a 512-dim OpenAI text embedding from wallpaper metadata.
 * Called at upload time (async). Stored in `text_embedding` column.
 * Powers /search: OpenAI text query ↔ OpenAI metadata embedding (same space ✓).
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
