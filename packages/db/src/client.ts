import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import dns from "node:dns";
import * as schema from "./schema/users";
import * as wallpaperSchema from "./schema/wallpapers";
import * as collectionSchema from "./schema/collections";
import * as interactionSchema from "./schema/interactions";
import * as authSchema from "./schema/auth";

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

  return drizzle(client, {
    schema: {
      ...schema,
      ...wallpaperSchema,
      ...collectionSchema,
      ...interactionSchema,
      ...authSchema,
    },
  });
}

export const db = createDb();
export type DbClient = typeof db;