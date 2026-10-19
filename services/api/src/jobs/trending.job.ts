import { sql } from "drizzle-orm";
import { db } from "../config/db";
import { purgeExpiredRejected } from "../services/admin/review.service";
import { fillMissingCategoryThumbs } from "../services/categoryThumb.service";
import { fillMissingThumbs } from "../services/wallpaperThumb.service";
import { fillMissingPhashes } from "../services/duplicate.service";
import { fillMissingDescriptions } from "../services/wallpaperDescription.service";
import { purgeStaleDrafts } from "../services/admin/upload.service";
/**
 * Trending score formula:
 * 
 * score = weighted_engagement / time_decay
 * 
 * weighted_engagement = (downloads × 3) + (likes × 2) + (views × 0.1)
 * time_decay = hours_since_upload ^ 0.8
 * 
 * Weights rationale:
 *   downloads = strongest intent signal (user saved it)
 *   likes     = explicit approval signal  
 *   views     = passive signal (could be accidental)
 * 
 * Decay rationale:
 *   ^ 0.8 = gradual decay curve
 *   1hr old  → decay factor 1.0  (full score)
 *   24hr old → decay factor 18.4 (score / 18.4)
 *   7d old   → decay factor 85.7 (score / 85.7)
 *   30d old  → decay factor 228  (score / 228)
 */

export async function recalculateTrendingScores(): Promise<{
  updated: number;
  durationMs: number;
}> {
  const start = Date.now();

  await db.execute(sql`
    UPDATE wallpapers
    SET trending_score = (
      (download_count * 3.0 + like_count * 2.0 + view_count * 0.1)
      /
      POWER(
        GREATEST(
          EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600.0,
          1.0
        ),
        0.8
      )
    )
    WHERE status = 'approved'
  `);

  // also zero out non-approved wallpapers
  await db.execute(sql`
    UPDATE wallpapers
    SET trending_score = 0
    WHERE status != 'approved'
  `);

  // get count of updated rows
  const result = await db.execute(sql`
    SELECT COUNT(*) as count FROM wallpapers WHERE status = 'approved'
  `);

  const row = result[0] as { count?: string | number } | undefined;
  const updated = Number(row?.count ?? 0);
  const durationMs = Date.now() - start;

  console.log(`[trending] Recalculated scores for ${updated} wallpapers in ${durationMs}ms`);

  return { updated, durationMs };
}

// ─── Hourly scheduler ──────────────────────────────────────
const INTERVAL_MS = 60 * 60 * 1000; // 1 hour

let schedulerRunning = false;
let intervalId: NodeJS.Timeout | null = null;

async function runJob() {
  if (schedulerRunning) return;
  schedulerRunning = true;
  try {
    console.log("[scheduler] Running trending score recalculation...");
    const result = await recalculateTrendingScores();
    console.log(`[scheduler] Done — ${result.updated} wallpapers updated in ${result.durationMs}ms`);
    const { purged } = await purgeExpiredRejected();
    if (purged > 0) console.log(`[scheduler] Purged ${purged} wallpapers rejected over 30 days ago`);
    const drafts = await purgeStaleDrafts().catch((e) => {
      console.error("[scheduler] Draft cleanup failed:", e instanceof Error ? e.message : e);
      return { purged: 0 };
    });
    if (drafts.purged) console.log(`[scheduler] Removed ${drafts.purged} unpublished upload drafts older than 24h`);
    const wallThumbs = await fillMissingThumbs(40, 3);
    if (wallThumbs.created || wallThumbs.failed) {
      console.log(`[scheduler] Wallpaper thumbnails: ${wallThumbs.created} created, ${wallThumbs.failed} failed, ${wallThumbs.remaining} still missing`);
    }
    // Duplicate-detection fingerprints for wallpapers from before it existed (and any that failed).
    const ph = await fillMissingPhashes(200, 4).catch((e) => {
      console.error("[scheduler] Fingerprints failed:", e instanceof Error ? e.message : e);
      return null;
    });
    if (ph && (ph.filled || ph.failed)) console.log(`[scheduler] Fingerprints: ${ph.filled} added, ${ph.failed} failed, ${ph.remaining} still missing`);
    // New uploads with no (or a one-line) description get a proper one, a few per hour.
    const desc = await fillMissingDescriptions(20, 3).catch((e) => {
      console.error("[scheduler] Descriptions failed:", e instanceof Error ? e.message : e);
      return null;
    });
    if (desc && (desc.written || desc.failed)) console.log(`[scheduler] Descriptions: ${desc.written} written, ${desc.failed} failed, ${desc.remaining} still thin`);
    const thumbs = await fillMissingCategoryThumbs();
    if (thumbs.created || thumbs.failed) console.log(`[scheduler] Category thumbnails: ${thumbs.created} created, ${thumbs.failed} failed`);
  } catch (error) {
    console.error("[scheduler] Trending recalculation failed:", error);
  } finally {
    schedulerRunning = false;
  }
}

export function startScheduler() {
  console.log("[scheduler] Starting — will recalculate trending scores every hour");

  // Only run on the hourly interval; skipping the immediate startup call avoids
  // a heavy SQL UPDATE on every cold-start (Render restarts after inactivity).
  intervalId = setInterval(() => {
    void runJob();
  }, INTERVAL_MS);
}

export function stopScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[scheduler] Stopped");
  }
}
