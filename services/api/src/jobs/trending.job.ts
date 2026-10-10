import { sql } from "drizzle-orm";
import { db } from "../config/db";
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
