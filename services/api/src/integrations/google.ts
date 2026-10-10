import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env";

export type GoogleProfile = {
  sub: string; // stable Google account id
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
};

const client = new OAuth2Client();

/** Client IDs whose ID tokens we accept (GOOGLE_CLIENT_ID, comma-separated). */
export function googleAudiences(): string[] {
  return (env.GOOGLE_CLIENT_ID ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Verify a Google Identity Services ID token (signature, issuer, audience, expiry)
 * and return the profile. Throws if the token is invalid.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  const ticket = await client.verifyIdToken({ idToken, audience: googleAudiences() });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) throw new Error("Google token missing sub/email");
  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: payload.email_verified === true,
    name: payload.name ?? null,
    picture: payload.picture ?? null,
  };
}
