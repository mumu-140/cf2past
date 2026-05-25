import { Env } from './index';
import { saveHistory } from './db';

export class Room implements DurableObject {
  private currentContent: string = '';
  private currentEntryId: number | null = null;

  constructor(private state: DurableObjectState, private env: Env) {
    // 从 DO storage 恢复 currentEntryId
    this.state.blockConcurrencyWhile(async () => {
      this.currentEntryId = (await this.state.storage.get<number>('entryId')) || null;
      this.currentContent = (await this.state.storage.get<string>('content')) || '';
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // POST /new → 开启新会话
    if (url.searchParams.get('action') === 'new') {
      this.currentEntryId = null;
      this.currentContent = '';
      await this.state.storage.put('entryId', 0);
      await this.state.storage.put('content', '');
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const userId = url.searchParams.get('uid') || '0';
    const room = url.searchParams.get('room') || 'default';

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.state.acceptWebSocket(server, [`uid:${userId}`, `room:${room}`]);

    if (this.currentContent) {
      server.send(this.currentContent);
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return;

    this.currentContent = message;
    await this.state.storage.put('content', message);

    const tags = this.state.getTags(ws);
    const userId = parseInt((tags.find(t => t.startsWith('uid:')) || 'uid:0').slice(4));
    const room = (tags.find(t => t.startsWith('room:')) || 'room:default').slice(5);

    // 广播给其他连接
    const allSockets = this.state.getWebSockets();
    for (const conn of allSockets) {
      if (conn !== ws) {
        try { conn.send(message); } catch {}
      }
    }

    // 写历史：同一会话只 UPDATE，不 INSERT 新记录
    if (userId && message.trim()) {
      const newId = await saveHistory(this.env.DB, room, message, userId, this.currentEntryId);
      if (newId !== this.currentEntryId) {
        this.currentEntryId = newId;
        await this.state.storage.put('entryId', newId);
      }
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    ws.close();
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    ws.close();
  }
}
