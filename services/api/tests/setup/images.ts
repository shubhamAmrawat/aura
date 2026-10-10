import sharp from "sharp";

/** Solid-colour PNG of the given size (real image bytes for upload tests). */
export async function pngOf(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 30, g: 120, b: 200 } },
  }).png().toBuffer();
}
