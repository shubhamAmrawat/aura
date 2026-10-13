import { expect } from "vitest";

/** Exact key-set match (order-independent). */
export function expectKeys(obj: unknown, keys: string[]) {
  expect(obj && typeof obj === "object").toBe(true);
  expect(Object.keys(obj as object).sort()).toEqual([...keys].sort());
}

export function expectError(res: { status: number; body: any }, status: number, message: string) {
  expect(res.status).toBe(status);
  expect(res.body).toEqual({ error: message });
}

export function expectSortedDesc(values: number[]) {
  for (let i = 1; i < values.length; i++) expect(values[i - 1]!).toBeGreaterThanOrEqual(values[i]!);
}

export const WALLPAPER_LIST_KEYS = [
  "id", "title", "fileUrl", "thumbUrl", "blurhash", "dominantColor", "palette", "width", "height",
  "likeCount", "downloadCount", "viewCount", "trendingScore", "isFeatured", "isPremium",
  "isMobile", "tags", "categoryId", "status", "createdAt", "format", "fileSizeBytes",
];

export const NONEXISTENT_UUID = "00000000-0000-4000-8000-000000000000";
