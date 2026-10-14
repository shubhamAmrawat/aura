import { encode } from "blurhash";
import sharp from "sharp";

// Keep memory flat on a small server: no decoded-image cache, at most 2 libvips threads per image.
sharp.cache(false);
sharp.concurrency(2);

const BLURHASH_FALLBACK = "LKO2:N%2Tw=w]~RBVZRi};RPxuwH";
/** Refuse absurd images (~16k × 16k) instead of trying to decode them. */
const MAX_INPUT_PIXELS = 268_402_689;

export type ImageMetadata = {
  dominantColor: string;
  palette: string[];
  blurhash: string;
  width: number;
  height: number;
  isMobile: boolean;
};

const DEFAULTS: ImageMetadata = {
  dominantColor: "#0a0a0a",
  palette: ["#0a0a0a"],
  blurhash: BLURHASH_FALLBACK,
  width: 0,
  height: 0,
  isMobile: false,
};

const hex = (r: number, g: number, b: number) =>
  `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;

/**
 * Size (EXIF-corrected), average colour, palette (average + corners), blurhash and isMobile
 * from image bytes. The full-size image is decoded once, straight down to 200px — nothing is
 * re-encoded at full size. Never throws: returns safe defaults (width 0) if the bytes aren't an image.
 */
export async function extractImageMetadataFromBuffer(buffer: Buffer): Promise<ImageMetadata> {
  try {
    const opts = { failOn: "none" as const, limitInputPixels: MAX_INPUT_PIXELS };
    const meta = await sharp(buffer, opts).metadata();
    // EXIF orientations 5–8 are rotated 90°, so the displayed width/height are swapped.
    const swap = (meta.orientation ?? 1) >= 5;
    const width = (swap ? meta.height : meta.width) ?? 0;
    const height = (swap ? meta.width : meta.height) ?? 0;
    if (!width || !height) return DEFAULTS;

    // One decode to a 200px copy (JPEGs shrink while decoding, so this is cheap)…
    const { data: px, info } = await sharp(buffer, opts)
      .rotate()
      .resize(200, 200, { fit: "inside" })
      .flatten({ background: { r: 0, g: 0, b: 0 } })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const w = info.width;
    const h = info.height;
    const ch = info.channels;
    if (w * h === 0 || ch < 3) return { ...DEFAULTS, width, height, isMobile: height / width >= 0.9 };

    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < px.length; i += ch) {
      r += px[i]!;
      g += px[i + 1]!;
      b += px[i + 2]!;
    }
    const n = w * h;
    const dominantColor = hex(Math.round(r / n), Math.round(g / n), Math.round(b / n));
    const palette = [dominantColor];
    for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]] as const) {
      const i = (y * w + x) * ch;
      const c = hex(px[i]!, px[i + 1]!, px[i + 2]!);
      if (!palette.includes(c)) palette.push(c);
    }

    // …and the blurhash from that small copy, not from the full image.
    const bh = await sharp(px, { raw: { width: w, height: h, channels: ch as 3 } })
      .resize(32, 32, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const blurhash = encode(new Uint8ClampedArray(bh.data), bh.info.width, bh.info.height, 4, 3);

    // Portrait/square (ratio ≥ 0.9) → mobile; clearly landscape (ratio < 0.9) → desktop
    return { dominantColor, palette, blurhash, width, height, isMobile: height / width >= 0.9 };
  } catch (error) {
    console.error("Metadata extraction failed:", error instanceof Error ? error.message : error);
    return DEFAULTS;
  }
}

/** Download an image and run extractImageMetadataFromBuffer. Never throws. */
export async function extractImageMetadata(fileUrl: string): Promise<ImageMetadata> {
  try {
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
    return await extractImageMetadataFromBuffer(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error("Metadata extraction failed:", error instanceof Error ? error.message : error);
    return DEFAULTS;
  }
}
