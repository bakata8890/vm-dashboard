import type { AuthUser } from '@/types/auth';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include', // envía la cookie HttpOnly automáticamente
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (body as { message?: string }).message ?? res.statusText);
  }

  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function getMe(): Promise<{ user: AuthUser }> {
  const user = await request('/api/me') as AuthUser;
  return { user };
}

export async function login(email: string, password: string): Promise<{ user: AuthUser }> {
  await request('/api/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return getMe();
}

export function logout(): Promise<void> {
  return request('/api/logout', { method: 'POST' });
}
