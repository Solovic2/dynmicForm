import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from './tokens.ts';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function parseError(res: Response): Promise<ApiError> {
  let message = res.statusText;
  try {
    const body = await res.json();
    message = body.message ?? message;
  } catch {
    // non-JSON body — keep statusText
  }
  return new ApiError(res.status, message);
}

// Single-flight guard: concurrent 401s share one refresh request.
let refreshPromise: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    clearTokens();
    return false;
  }

  const data = (await res.json()) as AuthResult;
  setTokens(data.accessToken, data.refreshToken);
  return true;
}

function refreshOnce(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/**
 * Authenticated fetch. Attaches the access token, and on a 401 transparently
 * refreshes once and retries the original request.
 */
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const send = (): Promise<Response> => {
    const headers = new Headers(options.headers);
    if (!headers.has('Content-Type') && options.body) {
      headers.set('Content-Type', 'application/json');
    }
    const token = getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(`${API_URL}${path}`, { ...options, headers });
  };

  let res = await send();

  if (res.status === 401 && getRefreshToken()) {
    const refreshed = await refreshOnce();
    if (refreshed) {
      res = await send();
    }
  }

  if (res.status === 204) return undefined as T;
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as T;
}

// ---- Auth endpoints ----

export async function register(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<PublicUser> {
  const result = await unauthed<AuthResult>('/auth/register', input);
  setTokens(result.accessToken, result.refreshToken);
  return result.user;
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<PublicUser> {
  const result = await unauthed<AuthResult>('/auth/login', input);
  setTokens(result.accessToken, result.refreshToken);
  return result.user;
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  }
  clearTokens();
}

export function me(): Promise<PublicUser> {
  return api<PublicUser>('/auth/me');
}

/** Attempt to restore a session at boot using the stored refresh token. */
export async function restoreSession(): Promise<PublicUser | null> {
  if (!getRefreshToken()) return null;
  const ok = await refreshOnce();
  if (!ok) return null;
  return me();
}

/** POST that does not require (or refresh) an access token. */
async function unauthed<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await parseError(res);
  const data = (await res.json()) as T;
  return data;
}
