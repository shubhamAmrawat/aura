import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { wallpaperRoutes } from "./routes/wallpapers";
import { categoryRoutes } from "./routes/categories";
import { authRoutes } from "./routes/auth";

const app = new Hono();

app.use("*", logger());
app.use("*", cors({
  origin: "*",
  credentials: false,
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
const port = parseInt(process.env.PORT ?? "3001", 10);

console.log(`Starting server on port ${port}`);

serve({
  fetch: app.fetch,
  port,
  hostname: "0.0.0.0",
}, (info) => {
  console.log(`API running at http://0.0.0.0:${info.port}`);
});