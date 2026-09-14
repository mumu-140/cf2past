import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { handleAuth, logout, validateSession } from '../src/auth';

function toHex(bytes: Uint8Array): string {
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function legacyHash(password: string): Promise<string> {
  const salt = Uint8Array.from({ length: 16 }, (_, index) => index + 11);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key,
    256,
  );
  return `${toHex(salt)}:${toHex(new Uint8Array(bits))}`;
}

async function insertUser(username: string, passwordHash = 'unused'): Promise<number> {
  const result = await env.DB.prepare(
    'INSERT INTO users (username, password_hash) VALUES (?, ?)'
  ).bind(username, passwordHash).run();
  return result.meta.last_row_id as number;
}

async function insertSession(token: string, userId: number): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+1 day'))"
  ).bind(token, userId).run();
}

describe('authentication migration', () => {
  beforeEach(() => {
    // D1 reset is provided by test/setup.ts.
  });

  it('requires at least eight password characters during setup', async () => {
    const request = new Request('https://clip.example/setup', {
      method: 'POST',
      body: new URLSearchParams({ username: 'admin', password: '1234567' }),
    });
    const response = await handleAuth(request, env, '/setup');
    expect(response.status).toBe(400);
    expect(await env.DB.prepare('SELECT COUNT(*) AS c FROM users').first<{ c: number }>()).toEqual({ c: 0 });
  });

  it('issues only the __Host session cookie for a new setup', async () => {
    const request = new Request('https://clip.example/setup', {
      method: 'POST',
      body: new URLSearchParams({ username: 'admin', password: '12345678' }),
    });
    const response = await handleAuth(request, env, '/setup');
    const cookie = response.headers.get('Set-Cookie') ?? '';
    expect(response.status).toBe(302);
    expect(cookie).toContain('__Host-cf2past_session=');
    expect(cookie).not.toMatch(/(?:^|[,;]\s*)session=/);
  });

  it('accepts a legacy password and upgrades it after successful login', async () => {
    const legacy = await legacyHash('legacy-pass');
    await insertUser('legacy-user', legacy);

    const request = new Request('https://clip.example/login', {
      method: 'POST',
      body: new URLSearchParams({ username: 'legacy-user', password: 'legacy-pass' }),
    });
    const response = await handleAuth(request, env, '/login');
    const row = await env.DB.prepare(
      'SELECT password_hash FROM users WHERE username = ?'
    ).bind('legacy-user').first<{ password_hash: string }>();

    expect(response.status).toBe(302);
    expect(response.headers.get('Set-Cookie')).toContain('__Host-cf2past_session=');
    expect(row?.password_hash).toMatch(/^pbkdf2-sha256\$600000\$/);
  });

  it('validates both new and still-unexpired legacy cookie names', async () => {
    const userId = await insertUser('cookie-user');
    await insertSession('new-token', userId);
    await insertSession('legacy-token', userId);

    const modern = await validateSession(new Request('https://clip.example/', {
      headers: { Cookie: '__Host-cf2past_session=new-token' },
    }), env);
    const legacy = await validateSession(new Request('https://clip.example/', {
      headers: { Cookie: 'session=legacy-token' },
    }), env);

    expect(modern).toEqual({ id: userId, username: 'cookie-user' });
    expect(legacy).toEqual({ id: userId, username: 'cookie-user' });
  });

  it('falls back to a valid legacy session when the new cookie is stale', async () => {
    const userId = await insertUser('fallback-user');
    await insertSession('valid-legacy-token', userId);

    const session = await validateSession(new Request('https://clip.example/', {
      headers: {
        Cookie: '__Host-cf2past_session=missing-new-token; session=valid-legacy-token',
      },
    }), env);

    expect(session).toEqual({ id: userId, username: 'fallback-user' });
  });

  it('rejects an expired ISO-8601 session on the current UTC date', async () => {
    const userId = await insertUser('expired-iso-user');
    const date = new Date().toISOString().slice(0, 10);
    await env.DB.prepare(
      'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
    ).bind('expired-iso-token', userId, `${date}T00:00:00.000Z`).run();

    const session = await validateSession(new Request('https://clip.example/', {
      headers: { Cookie: '__Host-cf2past_session=expired-iso-token' },
    }), env);

    expect(session).toBeNull();
  });

  it('logout deletes the active session and expires both cookie names', async () => {
    const userId = await insertUser('logout-user');
    await insertSession('logout-token', userId);

    const response = await logout(new Request('https://clip.example/logout', {
      method: 'POST',
      headers: { Cookie: '__Host-cf2past_session=logout-token' },
    }), env);
    const remaining = await env.DB.prepare(
      'SELECT COUNT(*) AS c FROM sessions WHERE token = ?'
    ).bind('logout-token').first<{ c: number }>();
    const cookie = response.headers.get('Set-Cookie') ?? '';

    expect(response.status).toBe(204);
    expect(remaining?.c).toBe(0);
    expect(cookie).toContain('__Host-cf2past_session=');
    expect(cookie).toContain('session=');
    expect(cookie).toContain('Max-Age=0');
  });

  it('logout deletes both server sessions when new and legacy cookies coexist', async () => {
    const userId = await insertUser('dual-cookie-user');
    await insertSession('dual-new-token', userId);
    await insertSession('dual-legacy-token', userId);

    await logout(new Request('https://clip.example/logout', {
      method: 'POST',
      headers: {
        Cookie: '__Host-cf2past_session=dual-new-token; session=dual-legacy-token',
      },
    }), env);

    const remaining = await env.DB.prepare(
      'SELECT COUNT(*) AS c FROM sessions WHERE token IN (?, ?)'
    ).bind('dual-new-token', 'dual-legacy-token').first<{ c: number }>();
    expect(remaining?.c).toBe(0);
  });

  it('opportunistically removes expired sessions after a successful login', async () => {
    const passwordHash = await legacyHash('cleanup-pass');
    const userId = await insertUser('cleanup-user', passwordHash);
    await env.DB.prepare(
      "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '-1 day'))"
    ).bind('expired-token', userId).run();

    const response = await handleAuth(new Request('https://clip.example/login', {
      method: 'POST',
      body: new URLSearchParams({ username: 'cleanup-user', password: 'cleanup-pass' }),
    }), env, '/login');
    expect(response.status).toBe(302);

    const expired = await env.DB.prepare(
      'SELECT COUNT(*) AS c FROM sessions WHERE token = ?'
    ).bind('expired-token').first<{ c: number }>();
    expect(expired?.c).toBe(0);
  });
});
