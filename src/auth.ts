import { Env } from './index';

export interface User {
  id: number;
  username: string;
}

const SESSION_DAYS = 7;
const PBKDF2_ITERATIONS = 100000;

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256
  );
  const hash = new Uint8Array(bits);
  const saltHex = [...salt].map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = [...hash].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${saltHex}:${hashHex}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256
  );
  const computed = [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
  return computed === hashHex;
}

function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie') || '';
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : null;
}

function sessionCookie(token: string): string {
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toUTCString();
  return `session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Expires=${expires}`;
}

export async function validateSession(request: Request, env: Env): Promise<User | null> {
  const token = getCookie(request, 'session');
  if (!token) return null;

  const row = await env.DB.prepare(
    `SELECT u.id, u.username FROM sessions s JOIN users u ON s.user_id = u.id
     WHERE s.token = ? AND s.expires_at > datetime('now')`
  ).bind(token).first<{ id: number; username: string }>();

  return row ? { id: row.id, username: row.username } : null;
}

async function createSession(userId: number, env: Env): Promise<string> {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  await env.DB.prepare(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
  ).bind(token, userId, expiresAt).run();
  return token;
}

export async function handleAuth(request: Request, env: Env, path: string): Promise<Response> {
  if (path === '/setup') return handleSetup(request, env);
  return handleLogin(request, env);
}

async function handleSetup(request: Request, env: Env): Promise<Response> {
  const { loginPage, setupPage } = await import('./pages');

  const userCount = await env.DB.prepare('SELECT COUNT(*) as c FROM users').first<{ c: number }>();
  if (userCount && userCount.c > 0) {
    return Response.redirect(new URL('/login', request.url).toString(), 302);
  }

  if (request.method === 'GET') {
    return new Response(setupPage(), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const form = await request.formData();
  const username = (form.get('username') as string || '').trim();
  const password = form.get('password') as string || '';

  if (!username || password.length < 4) {
    return new Response(setupPage('用户名不能为空，密码至少 4 位'), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
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
      'Location': '/',
      'Set-Cookie': sessionCookie(token),
    },
  });
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  const { loginPage, setupPage } = await import('./pages');

  const userCount = await env.DB.prepare('SELECT COUNT(*) as c FROM users').first<{ c: number }>();
  if (!userCount || userCount.c === 0) {
    return Response.redirect(new URL('/setup', request.url).toString(), 302);
  }

  if (request.method === 'GET') {
    return new Response(loginPage(), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const form = await request.formData();
  const username = (form.get('username') as string || '').trim();
  const password = form.get('password') as string || '';

  const user = await env.DB.prepare(
    'SELECT id, password_hash FROM users WHERE username = ?'
  ).bind(username).first<{ id: number; password_hash: string }>();

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return new Response(loginPage('用户名或密码错误'), {
      status: 401,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const token = await createSession(user.id, env);

  return new Response(null, {
    status: 302,
    headers: {
      'Location': '/',
      'Set-Cookie': sessionCookie(token),
    },
  });
}
