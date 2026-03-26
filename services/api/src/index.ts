import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { wallpaperRoutes } from "./routes/wallpapers";

const app = new Hono();

app.use("*", logger());
app.use("*", cors());

app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});
const port = Number(process.env.PORT || 3001);
app.route("/api/wallpapers", wallpaperRoutes);

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`API running at http://localhost:${info.port}`);
});