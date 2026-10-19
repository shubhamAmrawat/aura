import sharp from "sharp";

/**
 * Perceptual hash ("pHash") of an image: a 64-bit fingerprint that stays almost the same when the
 * image is resized, re-compressed, converted or lightly colour-edited, and changes a lot for a
 * different image. Two images are compared by how many bits differ (Hamming distance, 0–64).
 *
 * Recipe: greyscale → 32×32 → 2-D DCT → keep the 8×8 lowest frequencies → 1 bit per coefficient
 * (above / below their median, DC term left out).
 */
const N = 32;
const K = 8;

// cos((2x + 1) · u · π / 2N) for u < K, x < N — computed once
const COS: number[][] = Array.from({ length: K }, (_, u) =>
  Array.from({ length: N }, (_, x) => Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N)))
);

/** 64-bit pHash as a signed 64-bit integer string (fits a Postgres bigint). */
export async function computePhash(image: Buffer): Promise<string> {
  const { data } = await sharp(image, { failOn: "none", limitInputPixels: false })
    .rotate()
    .grayscale()
    .resize(N, N, { fit: "fill", kernel: "lanczos3" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Low-frequency DCT block (separable: rows, then columns)
  const rows: number[][] = Array.from({ length: N }, (_, y) =>
    Array.from({ length: K }, (_, u) => {
      let s = 0;
      for (let x = 0; x < N; x++) s += data[y * N + x]! * COS[u]![x]!;
      return s;
    })
  );
  const coeffs: number[] = [];
  for (let v = 0; v < K; v++) {
    for (let u = 0; u < K; u++) {
      let s = 0;
      for (let y = 0; y < N; y++) s += rows[y]![u]! * COS[v]![y]!;
      coeffs.push(s);
    }
  }

  const ac = coeffs.slice(1);
  const median = [...ac].sort((a, b) => a - b)[Math.floor(ac.length / 2)]!;
  let hash = 0n;
  for (let i = 1; i < 64; i++) if (coeffs[i]! > median) hash |= 1n << BigInt(i);
  return BigInt.asIntN(64, hash).toString();
}

/** Bits that differ between two hashes (0 = same picture, ≥ ~20 = unrelated). */
export function phashDistance(a: string, b: string): number {
  let x = BigInt.asUintN(64, BigInt(a) ^ BigInt(b));
  let n = 0;
  while (x) {
    n += Number(x & 1n);
    x >>= 1n;
  }
  return n;
}

/**
 * Pixel signature: the image as 32×32 greyscale (1024 bytes, base64). Two signatures are compared with
 * signatureSimilarity — a second, stricter test for pairs whose pHashes are close, since two different
 * images with a similar layout (a dark scene with a sun in the middle) can have close pHashes.
 */
export async function pixelSignature(image: Buffer): Promise<string> {
  const { data } = await sharp(image, { failOn: "none", limitInputPixels: false })
    .rotate()
    .grayscale()
    .resize(N, N, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return Buffer.from(data).toString("base64");
}

/** Pearson correlation of two pixel signatures: 1 = same picture, ~0.3 = unrelated images. */
export function signatureSimilarity(a: string, b: string): number {
  const x = Buffer.from(a, "base64");
  const y = Buffer.from(b, "base64");
  const n = Math.min(x.length, y.length);
  if (!n) return 0;
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { mx += x[i]!; my += y[i]!; }
  mx /= n; my /= n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i]! - mx, dy = y[i]! - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  // Flat images (one colour): the same only if they're the same shade
  if (!sxx || !syy) return !sxx && !syy && Math.abs(mx - my) < 2 ? 1 : 0;
  return sxy / Math.sqrt(sxx * syy);
}
