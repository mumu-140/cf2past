import type { Env } from './index';
import { createNonce, securityHeaders } from './http';
import { hashPassword, verifyPassword } from './password';

export interface User {
  id: number;
  username: string;
}

const SESSION_DAYS = 7;
const SESSION_COOKIE = '__Host-cf2past_session';
const LEGACY_SESSION_COOKIE = 'session';

function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie') ?? '';
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    const separator = trimmed.indexOf('=');
    if (separator < 0) continue;
    if (trimmed.slice(0, separator) === name) {
      return trimmed.slice(separator + 1) || null;
    }
  }
  return null;
}

function getSessionToken(request: Request): string | null {
  return getCookie(request, SESSION_COOKIE) ?? getCookie(request, LEGACY_SESSION_COOKIE);
}

function sessionCookie(token: string): string {
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000).toUTCString();
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Expires=${expires}`;
}

function expiredCookie(name: string): string {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

function htmlResponse(page: string, nonce: string, status = 200): Response {
  const headers = securityHeaders(nonce);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  return new Response(page, { status, headers });
}

async function cleanupExpiredSessions(env: Env): Promise<void> {
  try {
    await env.DB.prepare(
      "DELETE FROM sessions WHERE expires_at <= datetime('now')"
    ).run();
  } catch (error) {
    console.error('Failed to clean expired sessions', error);
  }
}

export async function validateSession(request: Request, env: Env): Promise<User | null> {
  const token = getSessionToken(request);
  if (!token) return null;

  const row = await env.DB.prepare(
    `SELECT u.id, u.username FROM sessions s JOIN users u ON s.user_id = u.id
     WHERE s.token = ? AND s.expires_at > datetime('now')`
  ).bind(token).first<{ id: number; username: string }>();

  return row ? { id: row.id, username: row.username } : null;
}

async function createSession(userId: number, env: Env): Promise<string> {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  await env.DB.prepare(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
  ).bind(token, userId, expiresAt).run();
  await cleanupExpiredSessions(env);
  return token;
}

export async function logout(request: Request, env: Env): Promise<Response> {
  const token = getSessionToken(request);
  if (token) {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  }

  const headers = new Headers();
  headers.append('Set-Cookie', expiredCookie(SESSION_COOKIE));
  headers.append('Set-Cookie', expiredCookie(LEGACY_SESSION_COOKIE));
  return new Response(null, { status: 204, headers });
}

export async function handleAuth(request: Request, env: Env, path: string): Promise<Response> {
  if (path === '/setup') return handleSetup(request, env);
  return handleLogin(request, env);
}

async function handleSetup(request: Request, env: Env): Promise<Response> {
  const { setupPage } = await import('./pages');

  const userCount = await env.DB.prepare('SELECT COUNT(*) as c FROM users').first<{ c: number }>();
  if (userCount && userCount.c > 0) {
    return Response.redirect(new URL('/login', request.url).toString(), 302);
  }

  if (request.method === 'GET') {
    const nonce = createNonce();
    return htmlResponse(setupPage(undefined, nonce), nonce);
  }

  const form = await request.formData();
  const username = String(form.get('username') ?? '').trim();
  const password = String(form.get('password') ?? '');

  if (!username || password.length < 8) {
    const nonce = createNonce();
    return htmlResponse(setupPage('用户名不能为空，密码至少 8 位', nonce), nonce, 400);
  }

  const hash = await hashPassword(password);
  const result = await env.DB.prepare(
    'INSERT INTO users (username, password_hash) VALUES (?, ?)'
  ).bind(username, hash).run();

  const userId = result.meta.last_row_id as number;
  const token = await createSession(userId, env);

  return new Response(null, {
    status: 302,
    headers: {
      Location: '/',
      'Set-Cookie': sessionCookie(token),
    },
  });
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  const { loginPage } = await import('./pages');

  const userCount = await env.DB.prepare('SELECT COUNT(*) as c FROM users').first<{ c: number }>();
  if (!userCount || userCount.c === 0) {
    return Response.redirect(new URL('/setup', request.url).toString(), 302);
  }

  if (request.method === 'GET') {
    const nonce = createNonce();
    return htmlResponse(loginPage(undefined, nonce), nonce);
  }

  const form = await request.formData();
  const username = String(form.get('username') ?? '').trim();
  const password = String(form.get('password') ?? '');

  const user = await env.DB.prepare(
    'SELECT id, password_hash FROM users WHERE username = ?'
  ).bind(username).first<{ id: number; password_hash: string }>();

  if (!user) {
    const nonce = createNonce();
    return htmlResponse(loginPage('用户名或密码错误', nonce), nonce, 401);
  }

  const verification = await verifyPassword(password, user.password_hash);
  if (!verification.valid) {
    const nonce = createNonce();
    return htmlResponse(loginPage('用户名或密码错误', nonce), nonce, 401);
  }

  if (verification.needsRehash) {
    const upgraded = await hashPassword(password);
    await env.DB.prepare(
      'UPDATE users SET password_hash = ? WHERE id = ?'
    ).bind(upgraded, user.id).run();
  }

  const token = await createSession(user.id, env);

  return new Response(null, {
    status: 302,
    headers: {
      Location: '/',
      'Set-Cookie': sessionCookie(token),
    },
  });
}
