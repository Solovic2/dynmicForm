import { createHash, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/** Claims carried by the access token. */
export interface AccessTokenPayload {
  sub: string; // user id
  email: string;
}

/** Claims carried by the refresh token. */
export interface RefreshTokenPayload {
  sub: string; // user id
  jti: string; // unique token id, also used to correlate the DB row
}

/** Sign a short-lived access token (default 1h). */
export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Sign a long-lived refresh token (default 7d).
 * Returns the token plus its `jti` and computed `expiresAt` so the caller can
 * persist a hash of it for rotation/revocation.
 */
export function signRefreshToken(userId: string): {
  token: string;
  jti: string;
  expiresAt: Date;
} {
  const jti = randomUUID();
  const token = jwt.sign({ sub: userId, jti } satisfies RefreshTokenPayload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.REFRESH_TOKEN_TTL as jwt.SignOptions['expiresIn'],
  });
  const decoded = jwt.decode(token) as { exp: number };
  return { token, jti, expiresAt: new Date(decoded.exp * 1000) };
}

/** Verify an access token, throwing on invalid/expired tokens. */
export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

/** Verify a refresh token, throwing on invalid/expired tokens. */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}

/** SHA-256 hash used to store refresh tokens without keeping the raw value. */
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
