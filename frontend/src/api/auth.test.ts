import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMe, login, ApiError } from './auth';

// Helpers para mockear fetch en jsdom
function mockFetch(...responses: Array<{ ok: boolean; status?: number; body: unknown }>) {
  let call = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
    const r = responses[call++] ?? responses[responses.length - 1];
    return Promise.resolve({
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 400),
      statusText: r.ok ? 'OK' : 'Error',
      json: () => Promise.resolve(r.body),
    } as Response);
  });
}

const ADMIN_USER = { id: '05e70d06', email: 'admin@vm.dev', role: 'admin' as const };

describe('getMe()', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('[REGRESIÓN] wraps la respuesta de /api/me en { user } — el bug era devolver AuthUser directo', async () => {
    // /api/me devuelve { id, email, role } — AuthUser directo, sin wrapper
    // getMe() debe envolverlo en { user } para que useAuth pueda hacer query.data.user
    mockFetch({ ok: true, body: ADMIN_USER });

    const result = await getMe();

    expect(result).toEqual({ user: ADMIN_USER });
    expect((result as unknown as typeof ADMIN_USER).email).toBeUndefined(); // no debe ser el AuthUser crudo
  });

  it('llama a /api/me con credentials include', async () => {
    mockFetch({ ok: true, body: ADMIN_USER });
    await getMe();
    expect(fetch).toHaveBeenCalledWith('/api/me', expect.objectContaining({ credentials: 'include' }));
  });

  it('lanza ApiError si /api/me devuelve 401', async () => {
    mockFetch({ ok: false, status: 401, body: { message: 'Unauthorized' } });
    await expect(getMe()).rejects.toBeInstanceOf(ApiError);
    await expect(getMe()).rejects.toMatchObject({ status: 401 });
  });
});

describe('login()', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('[REGRESIÓN] devuelve { user: AuthUser } — el bug era devolver { ok: "true" } del POST /api/login', async () => {
    // /api/login devuelve {"ok":"true"} — nunca contiene { user }
    // login() debe llamar a /api/me después y devolver su resultado
    mockFetch(
      { ok: true, body: { ok: 'true' } },  // POST /api/login
      { ok: true, body: ADMIN_USER },       // GET  /api/me
    );

    const result = await login('admin@vm.dev', 'admin123');

    expect(result).toEqual({ user: ADMIN_USER });
  });

  it('hace POST /api/login primero y GET /api/me después (orden correcto)', async () => {
    mockFetch(
      { ok: true, body: { ok: 'true' } },
      { ok: true, body: ADMIN_USER },
    );

    await login('admin@vm.dev', 'admin123');

    const calls = vi.mocked(fetch).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0]).toBe('/api/login');
    expect(calls[1][0]).toBe('/api/me');
  });

  it('el POST /api/login lleva email y password en el body', async () => {
    mockFetch(
      { ok: true, body: { ok: 'true' } },
      { ok: true, body: ADMIN_USER },
    );

    await login('admin@vm.dev', 'admin123');

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      email: 'admin@vm.dev',
      password: 'admin123',
    });
  });

  it('lanza ApiError si /api/login devuelve 401 (no llega a llamar /api/me)', async () => {
    mockFetch({ ok: false, status: 401, body: { message: 'Unauthorized' } });

    await expect(login('admin@vm.dev', 'wrong')).rejects.toMatchObject({ status: 401 });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1); // solo el POST, nunca el GET /api/me
  });
});
