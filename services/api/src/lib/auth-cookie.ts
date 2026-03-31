const WEEK_SEC = 7 * 24 * 60 * 60;

function commonAttrs(maxAge: number | "0"): string[] {
  const secure = process.env.NODE_ENV === "production";
  const domain = process.env.AUTH_COOKIE_DOMAIN?.trim();
  const attrs: string[] = [
    "HttpOnly",
    "Path=/",
    `Max-Age=${maxAge}`,
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
    ...(domain ? [`Domain=${domain}`] : []),
  ];
  return attrs;
}

/** Set-Cookie value for a new session (login / signup). */
export function auraTokenSetCookie(token: string): string {
  return [`aura_token=${token}`, ...commonAttrs(WEEK_SEC)].join("; ");
}

/** Set-Cookie to clear session (logout). */
export function auraTokenClearCookie(): string {
  return ["aura_token=", ...commonAttrs(0)].join("; ");
}
