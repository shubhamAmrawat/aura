export type ModerationResult = {
  status: "approved" | "pending" | "rejected";
  reason: string | null;
};

export async function checkImageSafety(imageUrl: string): Promise<ModerationResult> {
  const apiUser = process.env.SIGHTENGINE_API_USER;
  const apiSecret = process.env.SIGHTENGINE_API_SECRET;

  if (!apiUser || !apiSecret) {
    console.warn("Sightengine credentials not set — skipping moderation, auto-approving");
    return { status: "approved", reason: null };
  }

  try {
    const url = `https://api.sightengine.com/1.0/check.json?url=${encodeURIComponent(imageUrl)}&models=nudity,violence&api_user=${apiUser}&api_secret=${apiSecret}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error("Sightengine error:", response.status, response.statusText);
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
        reason: "Image flagged for manual review",
      };
    }

    return { status: "approved", reason: null };
  } catch (error) {
    console.error("Moderation failed:", error);
    return { status: "pending", reason: "Moderation service unavailable" };
  }
}