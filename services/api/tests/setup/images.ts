import sharp from "sharp";

let n = 0;

/**
 * PNG of the given size with its own random block pattern — real image bytes for upload tests.
 * Every call gives a different picture, so uploads don't trip duplicate detection
 * (reuse the same Buffer to test a duplicate on purpose).
 */
export async function pngOf(width: number, height: number): Promise<Buffer> {
  n++;
  const cells = 6;
  const raw = Buffer.alloc(cells * cells * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = Math.floor(Math.random() * 256);
  raw[0] = (n * 37) % 256; // guarantee calls differ even if Math.random repeats
  return sharp(raw, { raw: { width: cells, height: cells, channels: 3 } })
    .resize(width, height, { kernel: "nearest" })
    .png()
    .toBuffer();
}
