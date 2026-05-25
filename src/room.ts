import { Env } from './index';
import { saveHistory } from './db';

export class Room implements DurableObject {
  private currentContent: string = '';

  constructor(private state: DurableObjectState, private env: Env) {}

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get('uid') || '0';
    const room = url.searchParams.get('room') || 'default';

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // 用 tags 存储 userId 和 room，休眠后可恢复
    this.state.acceptWebSocket(server, [`uid:${userId}`, `room:${room}`]);

    // 新连接时发送当前内容
    if (this.currentContent) {
      server.send(this.currentContent);
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return;

    this.currentContent = message;

    const tags = this.state.getTags(ws);
    const userId = parseInt((tags.find(t => t.startsWith('uid:')) || 'uid:0').slice(4));
    const room = (tags.find(t => t.startsWith('room:')) || 'room:default').slice(5);

    // 广播给同房间其他连接
    const allSockets = this.state.getWebSockets();
    for (const conn of allSockets) {
      if (conn !== ws) {
        try { conn.send(message); } catch {}
      }
    }

    // 写历史
    if (userId && message.trim()) {
      this.state.waitUntil(saveHistory(this.env.DB, room, message, userId));
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    ws.close();
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    ws.close();
  }
}
