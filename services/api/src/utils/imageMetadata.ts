import { encode } from "blurhash";
import sharp from "sharp";

const BLURHASH_FALLBACK = "LKO2:N%2Tw=w]~RBVZRi};RPxuwH";

export type ImageMetadata = {
  dominantColor: string;
  palette: string[];
  blurhash: string;
  width: number;
  height: number;
  isMobile: boolean;
};

/**
 * Download an image and extract: average colour, 5-colour palette (average + corners),
 * blurhash, EXIF-corrected size, and isMobile (portrait/square). Never throws — returns
 * safe defaults if anything fails.
 */
export async function extractImageMetadata(fileUrl: string): Promise<ImageMetadata> {
  const defaults = {
    dominantColor: "#0a0a0a",
    palette: ["#0a0a0a"],
    blurhash: BLURHASH_FALLBACK,
    width: 0,
    height: 0,
    isMobile: false,
  };
  try {
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());

    // .rotate() with no args applies EXIF auto-rotation so stored width/height
    // always match what the browser displays (prevents portrait↔landscape mismatch)
    const rotatedBuffer = await sharp(buffer).rotate().toBuffer();
    const meta = await sharp(rotatedBuffer).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;

    const { data: rawPixels, info } = await sharp(rotatedBuffer)
      .resize(200, 200, { fit: "inside" })
      .flatten({ background: { r: 0, g: 0, b: 0 } })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const w = info.width;
    const h = info.height;
    const ch = info.channels;
    const pixelCount = w * h;
    if (pixelCount === 0 || ch < 3) throw new Error("Invalid pixel buffer");

    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < rawPixels.length; i += ch) {
      r += rawPixels[i]!;
      g += rawPixels[i + 1]!;
      b += rawPixels[i + 2]!;
    }
    r = Math.round(r / pixelCount);
    g = Math.round(g / pixelCount);
    b = Math.round(b / pixelCount);
    const dominantColor = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;

    const palette: string[] = [dominantColor];
    const corners: [number, number][] = [
      [0, 0],
      [w - 1, 0],
      [0, h - 1],
      [w - 1, h - 1],
    ];
    for (const [px, py] of corners) {
      if (palette.length >= 5) break;
      const sx = Math.max(0, Math.min(px, w - 1));
      const sy = Math.max(0, Math.min(py, h - 1));
      const idx = (sy * w + sx) * ch;
      const pr = rawPixels[idx]!;
      const pg = rawPixels[idx + 1]!;
      const pb = rawPixels[idx + 2]!;
      const hex = `#${pr.toString(16).padStart(2, "0")}${pg.toString(16).padStart(2, "0")}${pb.toString(16).padStart(2, "0")}`;
      if (!palette.includes(hex)) palette.push(hex);
    }

    const bhW = 32;
    const bhH = Math.max(1, Math.round((32 * Math.max(1, height)) / Math.max(1, width)));
    const { data: bhPixels, info: bhInfo } = await sharp(rotatedBuffer)
      .resize(bhW, bhH, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const blurhashValue = encode(
      new Uint8ClampedArray(bhPixels),
      bhInfo.width,
      bhInfo.height,
      4,
      3
    );

    return {
      dominantColor,
      palette,
      blurhash: blurhashValue,
      width,
      height,
      // Portrait/square (ratio ≥ 0.9) → mobile; clearly landscape (ratio < 0.9) → desktop
      isMobile: width > 0 ? height / width >= 0.9 : false,
    };
  } catch (error) {
    console.error("Metadata extraction failed:", error);
    return defaults;
  }
}
