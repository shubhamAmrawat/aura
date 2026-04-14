import { recalculateTrendingScores } from "./trending";

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