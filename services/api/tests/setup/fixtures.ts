import { sql } from "./db";
import type { TestUser } from "./auth";

/**
 * Insert a PENDING wallpaper owned by a test user (never visible on the site).
 * Copies a real wallpaper's text_embedding so vector SQL paths still run.
 */
export async function createTestWallpaper(owner: TestUser, overrides: { isMobile?: boolean; tags?: string[]; noEmbedding?: boolean; status?: "pending" | "approved"; createdAt?: Date } = {}) {
  const [cat] = await sql<{ id: string }[]>`SELECT id FROM categories ORDER BY sort_order LIMIT 1`;
  const [src] = await sql<{ text_embedding: string }[]>`
    SELECT text_embedding::text AS text_embedding FROM wallpapers
    WHERE text_embedding IS NOT NULL LIMIT 1`;

  const [row] = await sql<{ id: string }[]>`
    INSERT INTO wallpapers (
      title, description, file_url, blurhash, dominant_color, palette,
      width, height, file_size_bytes, format, category_id, uploader_id,
      tags, is_mobile, status, text_embedding, created_at
    ) VALUES (
      ${"test wallpaper " + owner.username}, ${"contract test fixture"},
      ${"https://example.com/test/" + owner.id + ".jpg"},
      ${"LKO2:N%2Tw=w]~RBVZRi};RPxuwH"}, ${"#123456"}, ${sql.array(["#123456"])},
      ${1080}, ${1920}, ${1000}, ${"jpeg"}, ${cat?.id ?? null}, ${owner.id},
      ${sql.array(overrides.tags ?? ["test"])}, ${overrides.isMobile ?? true}, ${overrides.status ?? "pending"},
      ${overrides.noEmbedding ? null : src?.text_embedding ?? null}::vector,
      ${overrides.createdAt ?? new Date()}
    ) RETURNING id`;
  return row!.id;
}
