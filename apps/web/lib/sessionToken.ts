// Verifies the API's session JWT (HS256) inside the Next.js middleware, using Web Crypto
// (works on the Edge runtime, no extra dependency). Needs JWT_SECRET — the same value as
// the API's — as a server-only env var (never NEXT_PUBLIC_).

export type SessionClaims = { userId: string; email: string; role?: string; exp?: number };

function base64UrlToBytes(input: string): Uint8Array<ArrayBuffer> {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

let cachedKey: { secret: string; key: CryptoKey } | null = null;

async function hmacKey(secret: string): Promise<CryptoKey> {
  if (cachedKey?.secret === secret) return cachedKey.key;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  cachedKey = { secret, key };
  return key;
}

/** Returns the token's claims if the signature is valid and it hasn't expired; otherwise null. */
export async function verifySessionToken(token: string | undefined): Promise<SessionClaims | null> {
  const secret = process.env.JWT_SECRET;
  if (!token || !secret) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts as [string, string, string];

    const header = JSON.parse(new TextDecoder().decode(base64UrlToBytes(headerB64))) as { alg?: string };
    if (header.alg !== "HS256") return null;

    const ok = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      base64UrlToBytes(sigB64),
      new TextEncoder().encode(`${headerB64}.${payloadB64}`)
    );
    if (!ok) return null;

    const claims = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadB64))) as SessionClaims;
    if (typeof claims.exp === "number" && claims.exp * 1000 <= Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}
