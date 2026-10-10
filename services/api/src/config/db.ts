import dns from "node:dns";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as models from "../models";

function createDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  // Render/Vercel containers often have no IPv6 route; this prevents DNS from
  // selecting AAAA records first (which caused ENETUNREACH in production).
  dns.setDefaultResultOrder("ipv4first");

  const client = postgres(connectionString, {
    ssl: "require",
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return drizzle(client, { schema: models });
}

export const db = createDb();
export type DbClient = typeof db;
