import { request } from "./api";

export type ReportReason = "nudity" | "violence" | "hate" | "harassment" | "copyright" | "spam" | "impersonation" | "other";

export const WALLPAPER_REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "nudity", label: "Nudity or sexual content" },
  { value: "violence", label: "Violence or gore" },
  { value: "hate", label: "Hate or harassment" },
  { value: "copyright", label: "Copyright: it's someone else's work" },
  { value: "spam", label: "Spam or misleading" },
  { value: "other", label: "Something else" },
];

export const USER_REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "impersonation", label: "Pretending to be someone else" },
  { value: "copyright", label: "Uploads other people's work" },
  { value: "harassment", label: "Harassment or hate" },
  { value: "nudity", label: "Posts sexual content" },
  { value: "spam", label: "Spam" },
  { value: "other", label: "Something else" },
];

/** Report a wallpaper or a creator. Works signed out too. */
export function reportContent(input: { targetType: "wallpaper" | "user"; targetId: string; reason: ReportReason; details?: string }) {
  return request<{ id: string; message: string }>("/api/reports", {
    method: "POST",
    body: JSON.stringify({ ...input, source: "mobile" }),
  });
}

export type BlockedCreator = { id: string; username: string; displayName: string; avatarUrl: string | null; blockedAt?: string };

/** Creators the signed-in user has blocked, newest first. */
export async function getBlockedCreators(): Promise<BlockedCreator[]> {
  const res = await request<{ data: BlockedCreator[] }>("/api/blocks");
  return res.data ?? [];
}

export function blockCreator(userId: string) {
  return request<{ blocked: true }>(`/api/blocks/${userId}`, { method: "POST" });
}

export function unblockCreator(userId: string) {
  return request<{ blocked: false }>(`/api/blocks/${userId}`, { method: "DELETE" });
}
