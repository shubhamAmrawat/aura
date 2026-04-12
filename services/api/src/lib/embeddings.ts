export type ModerationResult = {
  status: "approved" | "pending" | "rejected";
  reason: string | null;
};

let extractor: any = null;

async function getExtractor() {
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