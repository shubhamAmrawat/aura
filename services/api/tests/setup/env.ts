import fs from "node:fs";
import path from "node:path";

// Tests are always started via `pnpm --filter @aura/api ...`, so cwd = services/api.
const envPath = path.resolve(process.cwd(), "../../.env.test");
if (!fs.existsSync(envPath)) throw new Error(`.env.test not found at ${envPath}`);
process.loadEnvFile(envPath); // Node >= 20.12 built-in

if (process.env.EMAIL_TRANSPORT !== "log") {
  throw new Error("Refusing to run: EMAIL_TRANSPORT must be 'log' in .env.test");
}

export const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3001";
