import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { wallpaperRoutes } from "./routes/wallpapers";
import { categoryRoutes } from "./routes/categories";
import { authRoutes } from "./routes/auth";
import { profileRoutes } from "./routes/profile";
import { likesRoutes } from "./routes/likes";
import { collectionsRoutes } from "./routes/collections";
import { startScheduler } from "./lib/scheduler";

const app = new Hono();

// ─── Rate limiter ──────────────────────────────────────────
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const uploadCounts = new Map<string, { count: number; resetAt: number }>();

function getIp(c: any): string {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    "unknown"
  );
}

// general: 100 req/min per IP
app.use("*", async (c, next) => {
  const ip = getIp(c);
  const now = Date.now();
  const record = requestCounts.get(ip);

  if (!record || now > record.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + 60_000 });
    return next();
  }
  if (record.count >= 100) {
    return c.json({ error: "Too many requests. Please slow down." }, 429);
  }
  record.count++;
  return next();
});

// upload: 10 req/hour per IP
app.use("/api/wallpapers/upload*", async (c, next) => {
  const ip = getIp(c);
  const now = Date.now();
  const record = uploadCounts.get(ip);

  if (!record || now > record.resetAt) {
    uploadCounts.set(ip, { count: 1, resetAt: now + 3_600_000 });
    return next();
  }
  if (record.count >= 10) {
    return c.json({ error: "Upload limit reached. Try again in an hour." }, 429);
  }
  record.count++;
  return next();
});

app.use("*", logger());
app.use(cors({
  origin: [
    "https://www.aurawalls.site",
    "https://aurawalls.site",
    "http://localhost:3000", // keep for local dev
  ],
  credentials: true, // needed for cookies later
}));

app.get("/", (c) => {
  return c.json({ name: "AURA API", status: "ok" });
});

app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.route("/api/wallpapers", wallpaperRoutes);
app.route("/api/categories", categoryRoutes); 
app.route("/api/auth", authRoutes);
app.route("/api/profile", profileRoutes);
app.route("/api/likes", likesRoutes);
app.route("/api/collections", collectionsRoutes);
const port = parseInt(process.env.PORT ?? "3001", 10);

console.log(`Starting server on port ${port}`);

serve({
  fetch: app.fetch,
  port,
  hostname: "0.0.0.0",
}, (info) => {
  console.log(`API running at http://0.0.0.0:${info.port}`);
  
  startScheduler(); // start trending score scheduler
});