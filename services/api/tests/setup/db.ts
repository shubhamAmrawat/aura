import dns from "node:dns";
import postgres from "postgres";

// Direct DB access for tests: read own OTPs, insert own fixtures, verify side effects.
// NEVER touch rows that don't belong to a test user (see plan: Real-DB Safety Rules).
dns.setDefaultResultOrder("ipv4first");

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL missing in .env.test");

export const sql = postgres(url, { ssl: "require", max: 2, idle_timeout: 5 });
