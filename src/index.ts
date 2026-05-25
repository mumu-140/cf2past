import { handleAuth, validateSession } from './auth';
import { Room } from './room';
import { getHistory } from './db';
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

    // 静态认证路由（不需要 session）
    if (path === '/login' || path === '/setup') {
      return handleAuth(request, env, path);
    }

    // 其余路由需要认证
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

    // 历史 API
    if (path.startsWith('/api/history/')) {
      const room = path.slice(13) || 'default';
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
