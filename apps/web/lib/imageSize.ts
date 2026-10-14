/**
 * Pixel size of a JPEG, PNG or WebP read from its header — only the first bytes of the
 * file, no image decode. JPEG sizes are EXIF-corrected (orientations 5–8 swap width and
 * height), matching what the server stores. Returns null when the header can't be read.
 */
export async function readImageHeaderSize(file: Blob): Promise<{ width: number; height: number } | null> {
  const buf = new Uint8Array(await file.slice(0, 512 * 1024).arrayBuffer());
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const ascii = (o: number, n: number) => String.fromCharCode(...buf.subarray(o, o + n));
  try {
    // PNG: signature, then the IHDR chunk
    if (buf[0] === 0x89 && ascii(1, 3) === "PNG") return { width: dv.getUint32(16), height: dv.getUint32(20) };

    // WebP: RIFF....WEBP + VP8 / VP8L / VP8X chunk
    if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
      const kind = ascii(12, 4);
      if (kind === "VP8 ") return { width: dv.getUint16(26, true) & 0x3fff, height: dv.getUint16(28, true) & 0x3fff };
      if (kind === "VP8L") {
        const b0 = buf[21]!, b1 = buf[22]!, b2 = buf[23]!, b3 = buf[24]!;
        return { width: 1 + (((b1 & 0x3f) << 8) | b0), height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) };
      }
      if (kind === "VP8X") {
        const u24 = (o: number) => buf[o]! | (buf[o + 1]! << 8) | (buf[o + 2]! << 16);
        return { width: 1 + u24(24), height: 1 + u24(27) };
      }
      return null;
    }

    // JPEG: walk the segments to the frame header (SOFn); note the EXIF orientation on the way
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let orientation = 1;
      let o = 2;
      while (o + 9 < buf.length) {
        if (buf[o] !== 0xff) return null;
        const marker = buf[o + 1]!;
        if (marker === 0xff) { o++; continue; }
        const len = dv.getUint16(o + 2);
        if (marker === 0xe1 && ascii(o + 4, 4) === "Exif") orientation = exifOrientation(dv, o + 10) ?? orientation;
        const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
        if (isSof) {
          const height = dv.getUint16(o + 5);
          const width = dv.getUint16(o + 7);
          return orientation >= 5 ? { width: height, height: width } : { width, height };
        }
        o += 2 + len;
      }
    }
  } catch {
    // truncated or unusual header — caller falls back to loading the image
  }
  return null;
}

/** Orientation tag (0x0112) from a TIFF block starting at `t`. */
function exifOrientation(dv: DataView, t: number): number | null {
  const little = dv.getUint16(t) === 0x4949;
  const ifd = t + dv.getUint32(t + 4, little);
  const count = dv.getUint16(ifd, little);
  for (let i = 0; i < count; i++) {
    const e = ifd + 2 + i * 12;
    if (dv.getUint16(e, little) === 0x0112) return dv.getUint16(e + 8, little);
  }
  return null;
}
