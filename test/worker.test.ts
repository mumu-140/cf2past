import { env, exports as workerExports } from 'cloudflare:workers';
import { runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { MAX_CONTENT_BYTES } from '../src/http';
import { Room } from '../src/room';

const ORIGIN = 'https://clip.example';

async function authenticatedUser(name = 'worker-user'): Promise<{ userId: number; cookie: string; token: string }> {
  const user = await env.DB.prepare(
    'INSERT INTO users (username, password_hash) VALUES (?, ?)'
  ).bind(name, 'test-hash').run();
  const userId = user.meta.last_row_id as number;
  const token = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+1 day'))"
  ).bind(token, userId).run();
  return {
    userId,
    token,
    cookie: `__Host-cf2past_session=${token}`,
  };
}

function authedRequest(path: string, cookie: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set('Cookie', cookie);
  return new Request(`${ORIGIN}${path}`, { ...init, headers });
}

describe('Worker API boundaries', () => {
  it('rejects nested page paths instead of creating ambiguous room identities', async () => {
    const { cookie } = await authenticatedUser('nested-user');
    const response = await workerExports.default.fetch(authedRequest('/lab/test', cookie));
    expect(response.status).toBe(404);
  });

  it('returns 400 for malformed API room parameters', async () => {
    const { cookie } = await authenticatedUser('bad-room-user');
    const requests = [
      authedRequest('/api/history/%ZZ', cookie),
      authedRequest('/api/new/%ZZ', cookie, {
        method: 'POST',
        headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'x' }),
      }),
      authedRequest('/api/restore/%ZZ/1', cookie, {
        method: 'POST',
        headers: { Origin: ORIGIN },
      }),
      authedRequest('/api/ws/%ZZ', cookie, {
        headers: { Origin: ORIGIN, Upgrade: 'websocket' },
      }),
    ];

    for (const request of requests) {
      const response = await workerExports.default.fetch(request);
      if (response.webSocket) response.webSocket.close();
      expect(response.status).toBe(400);
    }
  });

  it('rejects cross-origin New before reaching the Durable Object', async () => {
    const { cookie } = await authenticatedUser('origin-user');
    const response = await workerExports.default.fetch(authedRequest('/api/new/work', cookie, {
      method: 'POST',
      headers: {
        Origin: 'https://evil.example',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: 'secret' }),
    }));
    expect(response.status).toBe(403);
  });

  it('rejects cross-origin restore and history mutations', async () => {
    const { cookie } = await authenticatedUser('mutation-origin-user');
    const requests = [
      authedRequest('/api/restore/work/1', cookie, {
        method: 'POST',
        headers: { Origin: 'https://evil.example' },
      }),
      authedRequest('/api/history/work/1', cookie, {
        method: 'DELETE',
        headers: { Origin: 'https://evil.example' },
      }),
      authedRequest('/api/history/work/1', cookie, {
        method: 'PATCH',
        headers: {
          Origin: 'https://evil.example',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'pin' }),
      }),
    ];

    for (const request of requests) {
      const response = await workerExports.default.fetch(request);
      expect(response.status).toBe(403);
    }
  });

  it('forwards final New content atomically under the authenticated user', async () => {
    const { cookie } = await authenticatedUser('new-route-user');
    const response = await workerExports.default.fetch(authedRequest('/api/new/work', cookie, {
      method: 'POST',
      headers: {
        Origin: ORIGIN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: 'final browser value' }),
    }));
    expect(response.status).toBe(200);

    const row = await env.DB.prepare(
      'SELECT content FROM history WHERE room = ? ORDER BY id DESC LIMIT 1'
    ).bind('work').first<{ content: string }>();
    expect(row?.content).toBe('final browser value');
  });

  it('restores content from the trusted D1 history row rather than client-supplied text', async () => {
    const { userId, cookie } = await authenticatedUser('restore-route-user');
    const inserted = await env.DB.prepare(
      'INSERT INTO history (room, content, user_id) VALUES (?, ?, ?)'
    ).bind('work', 'trusted snapshot', userId).run();
    const historyId = inserted.meta.last_row_id as number;

    const response = await workerExports.default.fetch(authedRequest(`/api/restore/work/${historyId}`, cookie, {
      method: 'POST',
      headers: {
        Origin: ORIGIN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: 'attacker supplied replacement' }),
    }));
    expect(response.status).toBe(200);

    const stub = env.ROOM.get(env.ROOM.idFromName('work'));
    const content = await runInDurableObject(stub, async (_instance: Room, state) =>
      (await state.storage.get<string>('content')) ?? ''
    );
    expect(content).toBe('trusted snapshot');
  });

  it('returns explicit errors for malformed, missing, and unknown history mutations', async () => {
    const { cookie } = await authenticatedUser('history-route-user');
    const headers = { Origin: ORIGIN };

    const malformed = await workerExports.default.fetch(authedRequest('/api/history/work/not-a-number', cookie, {
      method: 'DELETE',
      headers,
    }));
    expect(malformed.status).toBe(400);

    const missing = await workerExports.default.fetch(authedRequest('/api/history/work/999999', cookie, {
      method: 'DELETE',
      headers,
    }));
    expect(missing.status).toBe(404);

    const unknown = await workerExports.default.fetch(authedRequest('/api/history/work/999999', cookie, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'explode' }),
    }));
    expect(unknown.status).toBe(400);
  });

  it('rejects a cross-origin WebSocket upgrade before forwarding it', async () => {
    const { cookie } = await authenticatedUser('ws-origin-user');
    const response = await workerExports.default.fetch(authedRequest('/api/ws/work', cookie, {
      headers: {
        Upgrade: 'websocket',
        Origin: 'https://evil.example',
      },
    }));
    if (response.webSocket) response.webSocket.close();
    expect(response.status).toBe(403);
  });

  it('rejects cross-origin logout and leaves the session intact', async () => {
    const { cookie, token } = await authenticatedUser('logout-route-user');
    const response = await workerExports.default.fetch(authedRequest('/logout', cookie, {
      method: 'POST',
      headers: { Origin: 'https://evil.example' },
    }));
    expect(response.status).toBe(403);

    const row = await env.DB.prepare(
      'SELECT COUNT(*) AS c FROM sessions WHERE token = ?'
    ).bind(token).first<{ c: number }>();
    expect(row?.c).toBe(1);
  });

  it('uses one decoded Unicode room identity for history APIs', async () => {
    const { userId, cookie } = await authenticatedUser('unicode-route-user');
    await env.DB.prepare(
      'INSERT INTO history (room, content, user_id) VALUES (?, ?, ?)'
    ).bind('杨树', 'unicode room item', userId).run();

    const response = await workerExports.default.fetch(
      authedRequest('/api/history/%E6%9D%A8%E6%A0%91', cookie)
    );
    expect(response.status).toBe(200);
    const items = await response.json<Array<{ content: string }>>();
    expect(items.map(item => item.content)).toEqual(['unicode room item']);
  });

  it('rejects New content over the 1 MiB UTF-8 limit', async () => {
    const { cookie } = await authenticatedUser('limit-route-user');
    const response = await workerExports.default.fetch(authedRequest('/api/new/work', cookie, {
      method: 'POST',
      headers: {
        Origin: ORIGIN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: 'a'.repeat(MAX_CONTENT_BYTES + 1) }),
    }));
    expect(response.status).toBe(413);
  });
});
