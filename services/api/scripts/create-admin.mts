/**
 * Create a NEW admin account. Admins are separate accounts: this never converts an
 * existing user, and there is no API or sign-up path that can make someone an admin.
 *
 *   pnpm tsx --env-file=../../.env scripts/create-admin.mts admin@example.com
 *   pnpm tsx --env-file=../../.env scripts/create-admin.mts admin@example.com --name "Shubham (Admin)"
 *
 * You'll be asked for the password twice (typing is hidden). Sign in on the normal
 * login page — admins are taken straight to the dashboard.
 */
import * as readline from "node:readline";
import bcrypt from "bcryptjs";
import postgres from "postgres";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 12;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
}

// One readline interface for all questions (works with typed and piped input).
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
let muted = false;
// While muted, hide what's typed (the question itself is printed before muting).
(rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
  if (!muted) process.stdout.write(s);
};
const lines: string[] = [];
const waiters: ((line: string) => void)[] = [];
rl.on("line", (line) => (waiters.length ? waiters.shift()!(line) : lines.push(line)));

function askHidden(question: string): Promise<string> {
  process.stdout.write(question);
  muted = true;
  return new Promise((resolve) => {
    const done = (line: string) => { muted = false; process.stdout.write("\n"); resolve(line); };
    if (lines.length) done(lines.shift()!);
    else waiters.push(done);
  });
}

const email = process.argv[2]?.trim().toLowerCase();
if (!email || email.startsWith("--") || !EMAIL_REGEX.test(email)) {
  throw new Error('Usage: create-admin.mts <email> [--name "Display name"]');
}
const displayName = (arg("--name") ?? "Admin").trim().slice(0, 50) || "Admin";

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
try {
  const [existing] = await sql`SELECT 1 FROM users WHERE lower(email) = ${email} LIMIT 1`;
  if (existing) {
    throw new Error(`An account with ${email} already exists. Admins must be new accounts — use a different email.`);
  }

  const password = await askHidden(`Password for ${email} (min ${MIN_PASSWORD} characters): `);
  if (password.length < MIN_PASSWORD) throw new Error(`Password must be at least ${MIN_PASSWORD} characters.`);
  if ((await askHidden("Repeat password: ")) !== password) throw new Error("Passwords do not match.");

  // admin_<local part>, made unique if needed
  const base = `admin_${email.split("@")[0]!.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20)}`;
  let username = base;
  for (let i = 0; (await sql`SELECT 1 FROM users WHERE username = ${username}`).length > 0; i++) {
    username = `${base}_${Math.floor(1000 + Math.random() * 9000)}`;
    if (i > 10) throw new Error("Could not pick a free username.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const id = await sql.begin(async (tx) => {
    const [row] = await tx<{ id: string }[]>`
      INSERT INTO users (email, username, display_name, password_hash, is_email_verified, role)
      VALUES (${email}, ${username}, ${displayName}, ${passwordHash}, true, 'admin')
      RETURNING id`;
    await tx`INSERT INTO admin_actions (admin_id, action, target_type, target_id, details)
             VALUES (NULL, 'admin.create', 'user', ${row!.id}, ${sql.json({ via: "scripts/create-admin.mts", email, username })})`;
    return row!.id;
  });

  console.log(`\nAdmin created: ${email} (@${username}, id ${id}).`);
  console.log("Sign in on the normal login page — you'll go straight to the dashboard.");
} finally {
  rl.close();
  await sql.end();
}
