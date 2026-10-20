import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import morgan from "morgan";
import "./config/env"; // validate env before anything else
import { globalRateLimit } from "./middleware/rateLimit";
import { notFound } from "./middleware/notFound";
import { errorHandler } from "./middleware/errorHandler";
import { healthRoutes } from "./routes/health.routes";
import { apiRoutes } from "./routes";

export const ALLOWED_ORIGINS = [
  "https://www.aurora-walls.com",
  "https://aurora-walls.com",
  "http://localhost:3000", // local dev
];

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("etag", false); // previous API sent no ETags; avoid surprise 304s

  // Order matches the previous API: rate limit → logging → CORS → parsing → routes
  app.use(globalRateLimit);
  // Debugger tools on this machine (VS Code / Chrome DevTools) probe local ports for a
  // Chrome debugging endpoint (/json, /json/version, /json/list). They aren't our traffic,
  // so keep their 404s out of the request log.
  app.use(morgan("dev", { skip: (req) => /^\/json(\/|$)/.test(req.path) }));
  app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
  // gzip JSON responses (~80% less bandwidth); tiny bodies (<1 KB) are sent as-is
  app.use(compression());
  app.use(cookieParser());
  // Parse JSON for every non-multipart body (the old API ignored Content-Type)
  app.use(
    express.json({
      limit: "1mb",
      type: (req) => !String(req.headers["content-type"] ?? "").startsWith("multipart/"),
    })
  );

  app.use(healthRoutes);
  app.use("/api", apiRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
