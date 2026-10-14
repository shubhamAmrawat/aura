import { env } from "../config/env";
export type ModerationResult = {
  status: "approved" | "pending" | "rejected";
  reason: string | null;
};

/**
 * Nudity + violence check. Pass the small thumbnail URL when there is one: Sightengine
 * has to download whatever it's given, and a 600px WebP is checked as reliably as a 13 MB original.
 */
export async function checkImageSafety(imageUrl: string): Promise<ModerationResult> {
  const apiUser = env.SIGHTENGINE_API_USER;
  const apiSecret = env.SIGHTENGINE_API_SECRET;

  if (!apiUser || !apiSecret) {
    console.warn("Sightengine credentials not set — skipping moderation, auto-approving");
    return { status: "approved", reason: null };
  }

  try {
    const url = `https://api.sightengine.com/1.0/check.json?url=${encodeURIComponent(imageUrl)}&models=nudity,violence&api_user=${apiUser}&api_secret=${apiSecret}`;
    // 20 s timeout, and one retry after a network error, rate limit (429) or server error.
    let response: Response | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
        if (response.ok || (response.status !== 429 && response.status < 500)) break;
        console.warn(`Sightengine ${response.status} — ${attempt === 0 ? "retrying" : "giving up"}`);
      } catch (err) {
        response = null;
        console.warn(`Sightengine request failed (${err instanceof Error ? err.message : err}) — ${attempt === 0 ? "retrying" : "giving up"}`);
      }
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
    }

    if (!response || !response.ok) {
      console.error("Sightengine error:", response?.status ?? "no response", response?.statusText ?? "");
      return { status: "pending", reason: "Moderation service unavailable" };
    }

    const data = await response.json() as any;

    if (data.status !== "success") {
      console.error("Sightengine returned non-success:", data);
      return { status: "pending", reason: "Moderation check failed" };
    }

    const nudityScore: number = data.nudity?.raw ?? 0;
    const violenceScore: number = data.violence?.prob ?? 0;

    console.log(`Moderation scores — nudity: ${nudityScore.toFixed(2)}, violence: ${violenceScore.toFixed(2)}`);

    // hard reject
    if (nudityScore > 0.7 || violenceScore > 0.7) {
      return {
        status: "rejected",
        reason: "Image contains inappropriate content",
      };
    }

    // soft flag
    if (nudityScore > 0.4 || violenceScore > 0.4) {
      return {
        status: "pending",
        reason: `Flagged for manual review (nudity ${nudityScore.toFixed(2)}, violence ${violenceScore.toFixed(2)})`,
      };
    }

    return { status: "approved", reason: null };
  } catch (error) {
    console.error("Moderation failed:", error);
    return { status: "pending", reason: "Moderation service unavailable" };
  }
}