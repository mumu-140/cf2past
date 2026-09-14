import { handleAuth, logout, validateSession } from './auth';
import { Room } from './room';
import {
  deleteHistory,
  getHistory,
  getHistoryItem,
  togglePin,
  togglePreserve,
} from './db';
import { mainPage } from './pages';
import {
  MAX_CONTENT_BYTES,
  createNonce,
  isSameOrigin,
  securityHeaders,
  utf8Size,
} from './http';
import { parseApiRoom, parsePageRoom } from './rooms';

export { Room };

export interface Env {
  DB: D1Database;
  ROOM: DurableObjectNamespace;
}

function jsonError(error: string, status: number): Response {
  return Response.json({ error }, { status });
}

function parsePositiveId(raw: string): number | null {
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

function parseSingleRoomRoute(path: string, prefix: string): string | null {
  if (!path.startsWith(prefix)) return null;
  const rawRoom = path.slice(prefix.length);
  if (!rawRoom || rawRoom.includes('/')) return null;
  return parseApiRoom(rawRoom);
}

async function readContent(request: Request): Promise<string | null> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    return null;
  }

  if (!value || typeof value !== 'object') return null;
  const content = (value as { content?: unknown }).content;
  return typeof content === 'string' ? content : null;
}

async function forwardRoomAction(
  request: Request,
  env: Env,
  room: string,
  userId: number,
  action: 'new' | 'restore',
  content: string,
): Promise<Response> {
  const id = env.ROOM.idFromName(room);
  const stub = env.ROOM.get(id);
  const doUrl = new URL(request.url);
  doUrl.searchParams.set('action', action);

  return stub.fetch(new Request(doUrl.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room, userId, content }),
  }));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/login' || path === '/setup') {
      return handleAuth(request, env, path);
    }

    const user = await validateSession(request, env);
    if (!user) {
      return Response.redirect(new URL('/login', url.origin).toString(), 302);
    }

    if (path === '/logout') {
      if (request.method !== 'POST') {
        return jsonError('method not allowed', 405);
      }
      if (!isSameOrigin(request)) {
        return jsonError('forbidden', 403);
      }
      return logout(request, env);
    }

    if (path.startsWith('/api/ws/')) {
      if (!isSameOrigin(request)) {
        return jsonError('forbidden', 403);
      }

      const room = parseSingleRoomRoute(path, '/api/ws/');
      if (!room) {
        return jsonError('invalid room', 404);
      }

      const id = env.ROOM.idFromName(room);
      const stub = env.ROOM.get(id);
      const doUrl = new URL(request.url);
      doUrl.searchParams.set('uid', String(user.id));
      doUrl.searchParams.set('room', room);
      return stub.fetch(new Request(doUrl.toString(), request));
    }

    if (path.startsWith('/api/new/')) {
      if (request.method !== 'POST') {
        return jsonError('method not allowed', 405);
      }
      if (!isSameOrigin(request)) {
        return jsonError('forbidden', 403);
      }

      const room = parseSingleRoomRoute(path, '/api/new/');
      if (!room) {
        return jsonError('invalid room', 404);
      }

      const content = await readContent(request);
      if (content === null) {
        return jsonError('invalid payload', 400);
      }
      if (utf8Size(content) > MAX_CONTENT_BYTES) {
        return jsonError('content too large', 413);
      }

      return forwardRoomAction(request, env, room, user.id, 'new', content);
    }

    if (path.startsWith('/api/restore/')) {
      if (request.method !== 'POST') {
        return jsonError('method not allowed', 405);
      }
      if (!isSameOrigin(request)) {
        return jsonError('forbidden', 403);
      }

      const segments = path.slice('/api/restore/'.length).split('/');
      if (segments.length !== 2) {
        return jsonError('invalid restore route', 404);
      }

      const room = parseApiRoom(segments[0]);
      if (!room) {
        return jsonError('invalid room', 404);
      }

      const historyId = parsePositiveId(segments[1]);
      if (historyId === null) {
        return jsonError('invalid history id', 400);
      }

      const item = await getHistoryItem(env.DB, historyId, room);
      if (!item) {
        return jsonError('history item not found', 404);
      }
      if (utf8Size(item.content) > MAX_CONTENT_BYTES) {
        return jsonError('content too large', 413);
      }

      return forwardRoomAction(request, env, room, user.id, 'restore', item.content);
    }

    if (path.startsWith('/api/history/')) {
      const segments = path.slice('/api/history/'.length).split('/');
      if (segments.length < 1 || segments.length > 2 || !segments[0]) {
        return jsonError('invalid history route', 404);
      }

      const room = parseApiRoom(segments[0]);
      if (!room) {
        return jsonError('invalid room', 404);
      }

      if (segments.length === 1) {
        if (request.method !== 'GET') {
          return jsonError('method not allowed', 405);
        }
        const query = url.searchParams.get('q') || '';
        const items = await getHistory(env.DB, room, query);
        return Response.json(items);
      }

      if (!isSameOrigin(request)) {
        return jsonError('forbidden', 403);
      }

      const historyId = parsePositiveId(segments[1]);
      if (historyId === null) {
        return jsonError('invalid history id', 400);
      }

      if (request.method === 'DELETE') {
        const deleted = await deleteHistory(env.DB, historyId, room);
        return deleted
          ? Response.json({ ok: true })
          : jsonError('history item not found', 404);
      }

      if (request.method === 'PATCH') {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return jsonError('invalid payload', 400);
        }

        if (!body || typeof body !== 'object') {
          return jsonError('invalid payload', 400);
        }

        const action = (body as { action?: unknown }).action;
        let updated = false;
        if (action === 'pin') {
          updated = await togglePin(env.DB, historyId, room);
        } else if (action === 'preserve') {
          updated = await togglePreserve(env.DB, historyId, room);
        } else {
          return jsonError('unknown action', 400);
        }

        return updated
          ? Response.json({ ok: true })
          : jsonError('history item not found', 404);
      }

      return jsonError('method not allowed', 405);
    }

    if (path.startsWith('/api/')) {
      return jsonError('not found', 404);
    }

    const room = parsePageRoom(path);
    if (!room) {
      return new Response('Not Found', { status: 404 });
    }

    const nonce = createNonce();
    const headers = securityHeaders(nonce);
    headers.set('Content-Type', 'text/html; charset=utf-8');
    return new Response(mainPage(room, nonce), { headers });
  },
};
