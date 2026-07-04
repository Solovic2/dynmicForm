import { prisma } from '../db/prisma.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} from '../lib/tokens.js';
import type { LoginInput, RegisterInput } from '../schemas/auth.js';

/** Public representation of a user — never includes the password hash. */
export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
}

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

/** Error with an attached HTTP status for the route layer to translate. */
export class AuthError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

function toPublicUser(user: {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
}): PublicUser {
  return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
}

/** Issue a fresh access+refresh pair and persist the refresh token's hash. */
async function issueTokens(user: PublicUser): Promise<AuthResult> {
  const accessToken = signAccessToken({ sub: user.id, email: user.email });
  const { token: refreshToken, expiresAt } = signRefreshToken(user.id);

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshToken),
      userId: user.id,
      expiresAt,
    },
  });

  return { user, accessToken, refreshToken };
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AuthError(409, 'A user with this email already exists');
  }

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash: await hashPassword(input.password),
      name: input.name ?? null,
    },
  });

  return issueTokens(toPublicUser(user));
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  // Verify against the stored hash; use the same error for missing user and
  // wrong password to avoid leaking which emails are registered.
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new AuthError(401, 'Invalid email or password');
  }

  return issueTokens(toPublicUser(user));
}

/**
 * Rotate a refresh token: validate it, revoke the old row, and issue a new pair.
 * Any signature/expiry failure or a revoked/unknown token yields a 401.
 */
export async function refresh(rawRefreshToken: string): Promise<AuthResult> {
  let payload;
  try {
    payload = verifyRefreshToken(rawRefreshToken);
  } catch {
    throw new AuthError(401, 'Invalid or expired refresh token');
  }

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(rawRefreshToken) },
    include: { user: true },
  });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw new AuthError(401, 'Invalid or expired refresh token');
  }
  if (stored.userId !== payload.sub) {
    throw new AuthError(401, 'Invalid or expired refresh token');
  }

  // Revoke the presented token before issuing a replacement (rotation).
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  return issueTokens(toPublicUser(stored.user));
}

/** Revoke a refresh token (logout). Idempotent — unknown tokens are ignored. */
export async function logout(rawRefreshToken: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(rawRefreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Fetch the public profile for an authenticated user. */
export async function getUserById(id: string): Promise<PublicUser | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  return user ? toPublicUser(user) : null;
}
