export function clearToken(): void {
  // Cookie is cleared by the API logout endpoint via Set-Cookie: Max-Age=0
  // Nothing to do client-side
}

export function getToken(): string | null {
  // httpOnly cookies are not readable by JavaScript
  // Auth state is determined by /api/auth/me response
  return null;
}

export function saveToken(_token: string): void {
  // No-op — cookie is set by API via Set-Cookie response header
}
