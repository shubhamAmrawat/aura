import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/users";
import * as wallpaperSchema from "./schema/wallpapers";
import * as collectionSchema from "./schema/collections";
import * as interactionSchema from "./schema/interactions";

function createDb() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  console.log("Creating DB connection to:", connectionString.slice(0, 40));

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
    },
  });
}

export const db = createDb();
export type DbClient = typeof db;