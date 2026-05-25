import { handleAuth, validateSession } from './auth';
import { Room } from './room';
import { getHistory, deleteHistory, togglePin, togglePreserve } from './db';
import { loginPage, setupPage, mainPage } from './pages';

export { Room };

export interface Env {
  DB: D1Database;
  ROOM: DurableObjectNamespace;
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

    // WebSocket 升级
    if (path.startsWith('/api/ws/')) {
      const room = path.slice(8) || 'default';
      const id = env.ROOM.idFromName(room);
      const stub = env.ROOM.get(id);
      const doUrl = new URL(request.url);
      doUrl.searchParams.set('uid', String(user.id));
      doUrl.searchParams.set('room', room);
      return stub.fetch(new Request(doUrl.toString(), request));
    }

    // 新建会话
    if (path.startsWith('/api/new/') && request.method === 'POST') {
      const room = path.slice(9) || 'default';
      const id = env.ROOM.idFromName(room);
      const stub = env.ROOM.get(id);
      const doUrl = new URL(request.url);
      doUrl.searchParams.set('action', 'new');
      return stub.fetch(new Request(doUrl.toString(), { method: 'POST' }));
    }

    // 历史 API
    if (path.startsWith('/api/history/')) {
      const segments = path.slice(13).split('/');
      const room = segments[0] || 'default';

      // DELETE /api/history/:room/:id
      if (request.method === 'DELETE' && segments[1]) {
        await deleteHistory(env.DB, parseInt(segments[1]), room);
        return Response.json({ ok: true });
      }

      // PATCH /api/history/:room/:id
      if (request.method === 'PATCH' && segments[1]) {
        const body = await request.json<{ action: string }>();
        const id = parseInt(segments[1]);
        if (body.action === 'pin') await togglePin(env.DB, id, room);
        if (body.action === 'preserve') await togglePreserve(env.DB, id, room);
        return Response.json({ ok: true });
      }

      // GET /api/history/:room
      const query = url.searchParams.get('q') || '';
      const items = await getHistory(env.DB, room, query);
      return Response.json(items);
    }

    // 主页面
    const room = path === '/' ? 'default' : path.slice(1);
    return new Response(mainPage(room), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  },
};
