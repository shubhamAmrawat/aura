import { api } from "./http";
import { sql } from "./db";
import { testEmail, testUsername } from "./run";

export type TestUser = {
  id: string;
  email: string;
  username: string;
  password: string;
  token: string;
  cookie: string; // "aura_token=<jwt>"
};

/** Read the latest OTP for a TEST email straight from the DB. */
export async function readOtp(email: string, type: string): Promise<string> {
  if (!email.startsWith("aura-test+")) throw new Error(`Refusing to read OTP of non-test email ${email}`);
  const rows = await sql<{ code: string }[]>`
    SELECT code FROM otps WHERE email = ${email} AND type = ${type}
    ORDER BY created_at DESC LIMIT 1`;
  if (!rows[0]) throw new Error(`No ${type} OTP for ${email}`);
  return rows[0].code;
}

let counter = 0;

/** Full signup flow: send-otp → verify-otp → signup. */
export async function createUser(label?: string): Promise<TestUser> {
  const n = label ?? String(++counter);
  const email = testEmail(n);
  const username = testUsername(n);
  const password = "Test-password-123";

  const send = await api("POST", "/api/auth/send-otp", { json: { email, type: "signup" } });
  if (send.status !== 200) throw new Error(`send-otp failed ${send.status}: ${send.text}`);

  const code = await readOtp(email, "signup");
  const verify = await api("POST", "/api/auth/verify-otp", { json: { email, code, type: "signup" } });
  if (verify.status !== 200) throw new Error(`verify-otp failed ${verify.status}: ${verify.text}`);

  const signup = await api("POST", "/api/auth/signup", {
    json: { email, username, displayName: `Test ${n}`, password },
  });
  if (signup.status !== 200) throw new Error(`signup failed ${signup.status}: ${signup.text}`);

  const token: string = signup.body.token;
  return { id: signup.body.user.id, email, username, password, token, cookie: `aura_token=${token}` };
}

/** Flip a TEST user to creator (via the real endpoint). */
export async function makeCreator(user: TestUser): Promise<void> {
  const res = await api("PUT", "/api/auth/become-creator", { token: user.token });
  if (res.status !== 200) throw new Error(`become-creator failed ${res.status}: ${res.text}`);
}

/** Give a TEST user the admin role (direct DB write — there is no API for this). */
export async function makeAdmin(user: TestUser): Promise<void> {
  if (!user.email.startsWith("aura-test+")) throw new Error(`Refusing to promote non-test user ${user.email}`);
  await sql`UPDATE users SET role = 'admin' WHERE id = ${user.id}`;
}
