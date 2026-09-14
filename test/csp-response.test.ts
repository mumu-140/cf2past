import { env, exports as workerExports } from 'cloudflare:workers';
import { expect, it } from 'vitest';
import { handleAuth } from '../src/auth';

async function authenticatedCookie(): Promise<string> {
  const user = await env.DB.prepare(
    'INSERT INTO users (username, password_hash) VALUES (?, ?)'
  ).bind('csp-user', 'unused').run();
  const userId = user.meta.last_row_id as number;
  const token = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+1 day'))"
  ).bind(token, userId).run();
  return `__Host-cf2past_session=${token}`;
}

function nonceFromCsp(response: Response): string {
  const csp = response.headers.get('Content-Security-Policy') ?? '';
  const match = csp.match(/script-src[^;]*'nonce-([^']+)'/);
  return match?.[1] ?? '';
}

it('binds the authenticated page HTML to its CSP nonce', async () => {
  const cookie = await authenticatedCookie();
  const response = await workerExports.default.fetch(new Request('https://clip.example/work', {
    headers: { Cookie: cookie },
  }));
  const html = await response.text();
  const nonce = nonceFromCsp(response);

  expect(response.status).toBe(200);
  expect(nonce).not.toBe('');
  expect(html).toContain(`nonce="${nonce}"`);
  expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
});

it('binds the login page HTML to its CSP nonce', async () => {
  await env.DB.prepare(
    'INSERT INTO users (username, password_hash) VALUES (?, ?)'
  ).bind('login-csp-user', 'unused').run();

  const response = await handleAuth(new Request('https://clip.example/login'), env, '/login');
  const html = await response.text();
  const nonce = nonceFromCsp(response);

  expect(response.status).toBe(200);
  expect(nonce).not.toBe('');
  expect(html).toContain(`nonce="${nonce}"`);
  expect(response.headers.get('X-Frame-Options')).toBe('DENY');
});
