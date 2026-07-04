/**
 * Token storage.
 *
 * The access token is kept in memory only (cleared on full page reload — we
 * re-derive it from the refresh token at boot). The refresh token is persisted
 * in localStorage so a session survives reloads.
 *
 * Tradeoff: localStorage is readable by JS, so it is vulnerable to XSS. A more
 * hardened setup would store the refresh token in an httpOnly cookie, but that
 * requires @fastify/cookie on the backend (not installed here).
 */
const REFRESH_KEY = 'auth.refreshToken';

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(access: string, refresh: string): void {
  accessToken = access;
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens(): void {
  accessToken = null;
  localStorage.removeItem(REFRESH_KEY);
}
