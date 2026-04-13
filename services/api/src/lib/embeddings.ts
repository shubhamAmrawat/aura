export type ModerationResult = {
  status: "approved" | "pending" | "rejected";
  reason: string | null;
};

/** Must match DB `embedding` dimension (512) and image pipeline model. */
const CLIP_MODEL_ID = "Xenova/clip-vit-base-patch32";

/** When true, upload handler skips CLIP image embedding (saves a lot of RAM). Use on small hosts (e.g. Render512MB) or run a backfill job elsewhere. */
export function isImageEmbeddingSkippedOnUpload(): boolean {
  const v = (process.env.SKIP_IMAGE_EMBEDDING_ON_UPLOAD ?? "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function l2Normalize(data: Float32Array): number[] {
  const out = Array.from(data);
  let sumSq = 0;
  for (const x of out) sumSq += x * x;
  const n = Math.sqrt(sumSq) || 1;
  for (let i = 0; i < out.length; i++) out[i]! /= n;
  return out;
}

let extractor: any = null;
async function getExtractor() {
  if (!extractor) {
    const { pipeline, env } = await import("@xenova/transformers");
    env.cacheDir = "./.cache";
    extractor = await pipeline("image-feature-extraction", CLIP_MODEL_ID);
  }
  return extractor;
}

export async function generateImageEmbedding(
  imageUrl: string
): Promise<number[] | null> {
  try {
    const model = await getExtractor();
    const output = await model(imageUrl, { pooling: "mean", normalize: true });
    return Array.from(output.data) as number[];
  } catch (err) {
    console.error("Embedding generation failed:", err);
    return null;
  }
}

let clipTokenizer: any = null;
let clipTextModel: any = null;

/**
 * CLIP text embeddings must use the text tower + projection.
 * `pipeline("feature-extraction", clip)` targets the vision encoder and expects
 * `pixel_values`, which causes "Missing the following inputs: pixel_values".
 */
async function getClipTextStack() {
  if (!clipTokenizer || !clipTextModel) {
    const { env, AutoTokenizer, CLIPTextModelWithProjection } = await import(
      "@xenova/transformers"
    );
    env.cacheDir = "./.cache";
    clipTokenizer = await AutoTokenizer.from_pretrained(CLIP_MODEL_ID);
    clipTextModel = await CLIPTextModelWithProjection.from_pretrained(CLIP_MODEL_ID);
  }
  return { tokenizer: clipTokenizer, textModel: clipTextModel };
}

export async function generateTextEmbedding(
  text: string
): Promise<number[] | null> {
  try {
    const { tokenizer, textModel } = await getClipTextStack();
    const inputs = await tokenizer(text, { padding: true, truncation: true });
    const { text_embeds } = await textModel(inputs);
    if (!text_embeds?.data?.length) return null;
    return l2Normalize(text_embeds.data);
  } catch (err) {
    console.error("Text embedding failed:", err);
    return null;
  }
}